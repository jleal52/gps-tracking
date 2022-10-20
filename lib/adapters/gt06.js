/* Original code: https://github.com/cnberg/gps-tracking-nodejs/blob/master/lib/adapters/gt06.js */
f = require('../functions');
var crc = require('crc16-ccitt-node');


exports.protocol = 'GT06';
exports.model_name = 'GT06';
exports.compatible_hardware = ['GT06/supplier'];

var adapter = function (device) {
  if (!(this instanceof adapter)) {
    return new adapter(device);
  }

  this.format = {'start': '(', 'end': ')', 'separator': ''};
  this.device = device;
  
  /*******************************************
   PARSE THE INCOMING STRING FROM THE DECIVE
   You must return an object with a least: device_id, cmd and type.
   return device_id: The device_id
   return cmd: command from the device.
   return type: login_request, ping, etc.
   *******************************************/
  this.parse_data = function (data) {
    data = data.toString('hex');
    var parts = {
      'start': data.substr(0, 4)
    };
    //console.log('RAW:', data);

    if (parts['start'] == '7878') {
      parts['length'] = parseInt(data.substr(4, 2), 16);
      parts['finish'] = data.substr(6 + parts['length'] * 2, 4);

      parts['protocal_id'] = data.substr(6, 2); //Tipo de mensaje

      if (parts['finish'] != '0d0a') {
        console.log('FINAL INCORRECTO, IGNORAMOS...', data);
        parts['device_id'] = '';
        parts.cmd = 'noop';
        parts.action = 'noop';
        return parts;
      }

      //console.log('Calculando CRC de: ', data.substr(4, parts['length'] * 2 - 2))
      let crc16 = crc.getCrc16(Buffer.from(data.substr(4, parts['length'] * 2 - 2), 'hex')).toString(16);
      //console.log('CRC CALCULADO: ', crc16, ' CRC RECIBIDO: ', data.substr(2 + parts['length'] * 2, 4));
      if (crc16 != data.substr(2 + parts['length'] * 2, 4)) {
        console.log('CRC INCORRECTO, IGNORMAMOS...');
        parts['device_id'] = '';
        parts.cmd = 'noop';
        parts.action = 'noop';
        return parts;
      }

      if (parts['protocal_id'] == '01') { //Login
        parts['device_id'] = data.substr(8, 16);
        parts.cmd = 'login_request';
        parts.action = 'login_request';
      } else if (parts['protocal_id'] == '12' || parts['protocal_id'] == '22') { //Location Data (PING)
        parts['device_id'] = '';
        parts['data'] = data.substr(8, parts['length'] * 2);
        parts.cmd = 'ping';
        parts.action = 'ping';
      } else if (parts['protocal_id'] == '13') { //Status Information
        parts['device_id'] = '';
        parts['data'] = data.substr(8, parts['length'] * 2);
        parts.cmd = 'heartbeat';
        parts.action = 'heartbeat';
      } else if (parts['protocal_id'] == '16' || parts['protocal_id'] == '18') { //Alarm Data
        parts['device_id'] = '';
        parts['data'] = data.substr(8, parts['length'] * 2);
        parts.cmd = 'alarm';
        parts.action = 'alarm';
      } else {
        parts['device_id'] = '';
        parts.cmd = 'noop';
        parts.action = 'noop';
      }
      //console.log('PARTS: ', parts);
      return parts;
    } else {
      console.log('CERRAMOS POR TRAMA INCORRECTA', data);
      return null;
    }
    
  };
  this.authorize = function () {
    this.device.send(Buffer.from('787805010001d9dc0d0a', 'hex'));
  };
  this.zeroPad = function (nNum, nPad) {
    return ('' + (Math.pow(10, nPad) + nNum)).slice(1);
  };
  this.synchronous_clock = function (msg_parts) {

  };
  this.receive_heartbeat = function (msg_parts) {
    var buff = Buffer.from('787805130001d9dc0d0a', 'hex');
    this.device.send(buff);
  };
  this.run_other = function (cmd, msg_parts) {

  };

  this.request_login_to_device = function () {
    //@TODO: Implement this.
  };

  this.receive_alarm = function (msg_parts) {
    
  };

  this.dex_to_degrees = function (dex) {
    return parseInt(dex, 16) / 1800000;
  };

  this.get_ping_data = function (msg_parts) {
    var str = msg_parts.data;

    var data = {
      'time': new Date(Date.UTC(2000+parseInt(str.substr(0, 2), 16), 
                        parseInt(str.substr(2, 2), 16)-1, 
                        parseInt(str.substr(4, 2), 16), 
                        parseInt(str.substr(6, 2), 16), 
                        parseInt(str.substr(8, 2), 16), 
                        parseInt(str.substr(10, 2), 16))),
      'set_count': str.substr(12, 2),
      'latitude_raw': str.substr(14, 8),
      'longitude_raw': str.substr(22, 8),
      'latitude': this.dex_to_degrees(str.substr(14, 8)),
      'longitude': this.dex_to_degrees(str.substr(22, 8)),
      'speed': parseInt(str.substr(30, 2), 16),
      'orientation': parseInt(str.substr(32, 4), 16) & 0x3FF,
      'lbs': str.substr(36, 16),
      'acc': str.substr(52, 2),
      'upmode': str.substr(54, 2),
      'uptime': str.substr(56, 2),
      'serial': str.substr(58, 4),
      'raw': msg_parts.data
    };

    if ((parseInt(str.substr(32,2), 16) & 0x8) != 0) {
      data['longitude'] = -1 * data['longitude'];
    }
    if ((parseInt(str.substr(32,2), 16) & 0x4) == 0) {
      data['latitude'] = -1 * data['latitude'];
    }
    //console.log('PING: ', data);
   
    return data;
  };

  /* SET REFRESH TIME */
  this.set_refresh_time = function (interval, duration) {
  };
};
exports.adapter = adapter;