/**
 * Created by ryeubi on 2015-08-31.
 * Updated 2017.03.06
 * Made compatible with Thyme v1.7.2
 */

var net = require('net');
var util = require('util');
var fs = require('fs');
var xml2js = require('xml2js');


var wdt = require('./wdt');
//var sh_serial = require('./serial');

var SerialPort = require('serialport');

var usecomport = '';
var usebaudrate = '';
var useparentport = '';
var useparenthostname = '';

var upload_arr = [];
var download_arr = [];

var conf = {};

// This is an async file read
fs.readFile('conf.xml', 'utf-8', function (err, data) {
    if (err) {
        console.log("FATAL An error occurred trying to read in the file: " + err);
        console.log("error : set to default for configuration")
    }
    else {
        var parser = new xml2js.Parser({explicitArray: false});
        parser.parseString(data, function (err, result) {
            if (err) {
                console.log("Parsing An error occurred trying to read in the file: " + err);
                console.log("error : set to default for configuration")
            }
            else {
                var jsonString = JSON.stringify(result);
                conf = JSON.parse(jsonString)['m2m:conf'];

                usecomport = conf.tas.comport;
                usebaudrate = conf.tas.baudrate;
                useparenthostname = conf.tas.parenthostname;
                useparentport = conf.tas.parentport;

                if(conf.upload != null) {
                    if (conf.upload['ctname'] != null) {
                        upload_arr[0] = conf.upload;
                    }
                    else {
                        upload_arr = conf.upload;
                    }
                }

                if(conf.download != null) {
                    if (conf.download['ctname'] != null) {
                        download_arr[0] = conf.download;
                    }
                    else {
                        download_arr = conf.download;
                    }
                }
            }
        });
    }
});


var tas_state = 'init';

var upload_client = null;

var t_count = 0;


function timer_upload_action() {
    if (tas_state == 'upload') {
        var con = {value: 'TAS' + t_count++ + ',' + '55.2'};
        for (var i = 0; i < upload_arr.length; i++) {
            if (upload_arr[i].id == 'timer') {
                var cin = {ctname: upload_arr[i].ctname, con: con};
                console.log(JSON.stringify(cin) + ' ---->');
                upload_client.write(JSON.stringify(cin) + '<EOF>');
                break;
            }
        }
    }
}

function serial_upload_action() {
    if (tas_state == 'upload') {
        var buf = new Buffer(4);
        buf[0] = 0x11;
        buf[1] = 0x01;
        buf[2] = 0x01;
        buf[3] = 0xED;
        myPort.write(buf);
    }
}

var tas_download_count = 0;

function on_receive(data) {
    if (tas_state == 'connect' || tas_state == 'reconnect' || tas_state == 'upload') {
        var data_arr = data.toString().split('<EOF>');
        if(data_arr.length >= 2) {
            for (var i = 0; i < data_arr.length - 1; i++) {
                var line = data_arr[i];
                var sink_str = util.format('%s', line.toString());
                var sink_obj = JSON.parse(sink_str);

                if (sink_obj.ctname == null || sink_obj.con == null) {
                    console.log('Received: data format mismatch');
                }
                else {
                    if (sink_obj.con == 'hello') {
                        console.log('Received: ' + line);

                        if (++tas_download_count >= download_arr.length) {
                            tas_state = 'upload';
                        }
                    }
                    else {
                        for (var j = 0; j < upload_arr.length; j++) {
                            if (upload_arr[j].ctname == sink_obj.ctname) {
                                console.log('ACK : ' + line + ' <----');
                                break;
                            }
                        }

                        for (j = 0; j < download_arr.length; j++) {
                            if (download_arr[j].ctname == sink_obj.ctname) {
                                g_down_buf = JSON.stringify({id: download_arr[i].id, con: sink_obj.con});
                                console.log(g_down_buf + ' <----');
                                myPort.write(g_down_buf);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}


// var SerialPort = null;
var myPort = null;
function tas_watchdog() {
    if(tas_state == 'init') {
        upload_client = new net.Socket();

        upload_client.on('data', on_receive);

        /* ??????!!!!
        upload_client.on('error', function(err) {
            console.log(err);
            tas_state = 'reconnect';
        });

        upload_client.on('close', function() {
            console.log('Connection closed');
            upload_client.destroy();
            tas_state = 'reconnect';
        });
        */

        if(upload_client) {
            console.log('tas init ok');
            tas_state = 'init_serial';
        }
    }
    else if(tas_state == 'init_serial') {
        
        /* ??????!!!!!
        SerialPort = serialport.SerialPort;
    	
        serialport.list(function (err, ports) {
            ports.forEach(function (port) {
                console.log(port.comName);
            });
        });
        

        myPort = new SerialPort(usecomport, {
            baudRate : parseInt(usebaudrate, 10),
            buffersize : 1
            //parser : serialport.parsers.readline("\r\n")
        });

        myPort.on('open', showPortOpen);
        myPort.on('data', saveLastestData);
        myPort.on('close', showPortClose);
        myPort.on('error', showError);
        */
        myPort=1; //??????!!!!

        if(myPort) {
            console.log('tas init serial ok');
            tas_state = 'connect';
        }
    }
    else if(tas_state == 'connect' || tas_state == 'reconnect') {
        upload_client.connect(useparentport, useparenthostname, function() {
            console.log('upload Connected');
            tas_download_count = 0;
            for (var i = 0; i < download_arr.length; i++) {
                console.log('download Connected - ' + download_arr[i].ctname + ' hello');
                var cin = {ctname: download_arr[i].ctname, con: 'hello'};
                upload_client.write(JSON.stringify(cin) + '<EOF>');
            }

            if (tas_download_count >= download_arr.length) {
                tas_state = 'upload';
            }
        });
    }
}


//wdt.set_wdt(require('shortid').generate(), 2, timer_upload_action);
wdt.set_wdt(require('shortid').generate(), 3, tas_watchdog);
//wdt.set_wdt(require('shortid').generate(), 3, serial_upload_action);

//wdt.set_wdt(require('shortid').generate(), 10, sme20u_upload_action);
wdt.set_wdt(require('shortid').generate(), 180, tvoc_upload_action);



var cur_c = '';
var pre_c = '';
var g_sink_buf = '';
var g_sink_ready = [];
var g_sink_buf_start = 0;
var g_sink_buf_index = 0;
var g_down_buf = '';

function showPortOpen() {
    console.log('port open. Data rate: ' + myPort.options.baudRate);
}

var count = 0;
function saveLastestData(data) {
    var val = data.readUInt16LE(0, true);

    if(g_sink_buf_start == 0) {
        if(val == 0x16) {
            count = 1;
            g_sink_buf_start = 1;
            g_sink_ready.push(val);
        }
    }
    else if(g_sink_buf_start == 1) {
        if(val == 0x05) {
            count = 2;
            g_sink_buf_start = 2;
            g_sink_ready.push(val);
        }
    }
    else if(g_sink_buf_start == 2) {
        if(val == 0x01) {
            count = 3;
            g_sink_buf_start = 3;
            g_sink_ready.push(val);
        }
    }
    else if(g_sink_buf_start == 3) {
        count++;
        g_sink_ready.push(val);

        if(count >= 9){
            console.log(g_sink_ready);

            /*CO2 ?????? ??????
            SEND(4?????????) : 0x11, 0x01, 0x01, 0xED
            Respond(8?????????) : 0x16, 0x05, 0x01, 0x02, 0x72, 0x01, 0xD6, 0x99
            ????????? 0x16, 0x05, 0x01 ??? ?????? ?????? ?????? ?????????, ????????? ????????? 0x02, 0x72 ??? ????????? ???????????? ???????????????.
            (HEX) 0x0272 = 626
            ???, ????????? 626 ppm ?????????. */

            var nValue = g_sink_ready[3] * 256 + g_sink_ready[4];

            console.log(nValue);

            if(tas_state == 'upload') {
                for(var i = 0; i < upload_arr.length; i++) {
                    if(upload_arr[i].ctname == 'cnt-co2') {
                        var cin = {ctname: upload_arr[i].ctname, con: nValue.toString()};
                        console.log('SEND : ' + JSON.stringify(cin) + ' ---->');
                        upload_client.write(JSON.stringify(cin) + '<EOF>');
                        break;
                    }
                }
            }

            g_sink_ready = [];
            count = 0;
            g_sink_buf_start = 0;
        }
    }
}

function showPortClose() {
    console.log('port closed.');
}

function showError(error) {
    var error_str = util.format("%s", error);
    console.log(error.message);
    if (error_str.substring(0, 14) == "Error: Opening") {

    }
    else {
        console.log('SerialPort port error : ' + error);
    }
}







// ????????? ?????? ?????????!!
var request = require('request');
var options = {
  'method': 'GET',
  'url': 'http://115.68.37.90/api/logs/latest',
  'headers': {
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImIxM2M3YzhmMzYwMDAzNGExZDVhNDkzZWI5NWVkZGY4MDIwMzI4YzU4ZGM1ODMxY2JhYWI5YTU1ZTE2YTA4YTk5YWUyNzVmYmVlM2NlYTc2In0.eyJhdWQiOiIxIiwianRpIjoiYjEzYzdjOGYzNjAwMDM0YTFkNWE0OTNlYjk1ZWRkZjgwMjAzMjhjNThkYzU4MzFjYmFhYjlhNTVlMTZhMDhhOTlhZTI3NWZiZWUzY2VhNzYiLCJpYXQiOjE1NzI0Mjc0NTAsIm5iZiI6MTU3MjQyNzQ1MCwiZXhwIjoxNTg4MjM4NjUwLCJzdWIiOiIxMDAwMDAwMDAwMSIsInNjb3BlcyI6W119.IQj7AjsyRpX9Y8jJI2HJJOL221m95YRbbbX_VpvH-Nfb2NjF6w1E43qbv7tzLJqOPlsz0OkzmEDbp0405FMMan8K8Z1NdBhjaRPFDAdCaosudMUZXsovOP0buJWtoR-pcaG5MQ46wVbjBeSBJFqMzDgSrFQyjf_71Tk0MH4JLVPQVyVuTKdh_a3AWYi0BOAf6Mu31erd7i0ArkOSXeRvGnsh64qWHMuoLThy83wN7D2eTnKqHeOAbhXIJhRYWJrLI0pEzsQTy1-TC0oftKntAVVJIFx2HTOyHnCacgA2MVv8SKDu_Y6ZAoFkDv9t0KjsB7ZQKesoGUA5VHDOVdyQvtivCaNBJRLqF6r6DJhM8qP4AyDooZ5x9kfBV607MeKGm6dSFx-2EBKyqB9HSyjEBq-kD5S_iJ4Vw7MGHsh8qHjivUNXMYXcY70jktfk-OMeQ4EZz1J5WMur1jsU4rTaVFipWaF7l4-Q4kfsnBS4nMt6Gq3mCFgjEkgF0QfhpPYiNEUcpmUqG61wfgl1TQ6q2OPvYtpsxVff89TLvXriV0CfBePlw6rfr3hg8wZnkH0P7BirGA6RfTHDlXOG6432528pgZeowYpJtQBmey1iP7P1aQGmIeeeWrI2RbM8Eat_oQMoT0RShx66lmKlg8zxaXsDDSWcfdYlRC53s_0RfNE'
  }
};

/*
// 1??? ?????? (sme20 API ???????????? ????????? ??????)
request(options, function (error, response) { 
  if (error) throw new Error(error);
  console.log(response.body);
});
*/

/*
// 2??? ?????? (DGU0010??? ???????????? _???????????????x)
var body={};
request(options, function (error, response) { 
  if (error) throw new Error(error);
  body = JSON.parse(response.body);
  for (var i = 0 ; i < body.result.length ; i++){
      if (body.result[i].DEVICE_SCODE == 'DGU0010'){
          console.log(body.result[i]);
      }
  }
});
*/

/*
// 3??? ?????? (co2, tvoc ???????????? mySQL ???????????? ?????? ??????)
var body={};
var ind=0;
function sme20u_upload_action() {
    if (tas_state == 'upload') {
        request(options, function (error, response) { 
            if (error) throw new Error(error);
            body = JSON.parse(response.body);
            for (var i = 0 ; i < body.result.length ; i++){
                if (body.result[i].DEVICE_SCODE == 'DGU0010'){
                    console.log(body.result[i]);
                    ind=i;
                    var con1 = {value: body.result[ind].DEVICE_FIELD10};
                    for (var j = 0; j< upload_arr.length; j++) {
                        if (upload_arr[j].id == 'co2') {
                            var cin = {ctname: upload_arr[j].ctname, con: con1};
                            console.log(JSON.stringify(cin) + ' ---->');
                            upload_client.write(JSON.stringify(cin) + '<EOF>');
                            break;
                        }
                    }
                    var con2 = {value: body.result[ind].DEVICE_FIELD11};
                    for (var j = 0; j< upload_arr.length; j++) {
                        if (upload_arr[j].id == 'tvoc') {
                            var cin = {ctname: upload_arr[j].ctname, con: con2};
                            console.log(JSON.stringify(cin) + ' ---->');
                            upload_client.write(JSON.stringify(cin) + '<EOF>');
                            break;
                        }
                    }
                }
            }
          });   
    }
}
*/





var express = require('express');
var app = express();
var title = '???????????? ???????????? ????????????';
var stime = '';
var ppb = '';

app.get('/', function(req, res){
    var text = `<h2>${title}</h2>${stime}<br/>${ppb}`;
    res.send(text);
});
app.listen(3003);
console.log("App server running on port 3003");

function tvoc_upload_action() {
    if (tas_state == 'upload') {
        request(options, function (error, response) { 
            if (error) throw new Error(error);
            var body = JSON.parse(response.body);
            for (var i = 0 ; i < body.result.length ; i++){
                if (body.result[i].DEVICE_SCODE == 'DGU0010'){
                    console.log(body.result[i]);
                    var con = body.result[i].DEVICE_FIELD11;
                    var time = body.result[i].DEVICE_DATA_REG_DTM;
                    for (var j = 0; j< upload_arr.length; j++) {
                        if (upload_arr[j].id == 'tvoc') {
                            var cin = {ctname: upload_arr[j].ctname, con: con};
                            console.log(JSON.stringify(cin) + ' ---->');
                            upload_client.write(JSON.stringify(cin) + '<EOF>');
                            break;
                        }
                    }
                    if (con >= 800){
                        stime = '?????? ??????: ' + time;
                        ppb = 'tvoc ??????: ' + con + 'ppb';
                        title = '????????? ?????????';
                    }
                    else if (con >= 200){
                        stime = '?????? ??????: ' + time;
                        ppb = 'tvoc ??????: ' + con + 'ppb';
                        title = '????????? ?????????';
                    }
                    else{
                        stime = '?????? ??????: ' + time;
                        ppb = 'tvoc ??????: ' + con + 'ppb';
                        title = '?????? ????????????';
                    }
                }
            }
          });
        
    }
}
