/**
 * This NodeJS client acts as the main loop for GrovePi board with Grove sensors.
 * Using a sensor-config.js file to setup the type of sensors and corresponding PIN of 
 * your device project, this code runs in loop by itself to detect sensor value changes 
 * and push to IoTCS.
 *
 * This client is a directly connected device using IoTCS csl virtual device API.
 *
 * This script works with IoTCS version 16.4.1.x.x and above
 *
 * 02/23/2017.  yuhua.xie@oracle.com
 */

"use strict";

//TODO: please supply the device model associated with your device
const DEVICE_MODEL_URN = 'urn:com:oracle:iot:workshopdevicemodel';

// Setup IoT Device Client Lib
// IoTCS device library in NodeJS
var iotClient = require("device-library.node");
iotClient = iotClient({debug: true});
iotClient.oracle.iot.tam.store = (process.argv[2]);
iotClient.oracle.iot.tam.storePassword = (process.argv[3]);

// GrovePi sensors
const GrovePi = require('node-grovepi').GrovePi;
const Board = GrovePi.board;
const UltrasonicDigitalSensor = GrovePi.sensors.UltrasonicDigital;
const DHTDigitalSensor = GrovePi.sensors.DHTDigital;
const LightAnalogSensor = GrovePi.sensors.LightAnalog;
const Digital = GrovePi.sensors.base.Digital;
const Analog = GrovePi.sensors.base.Analog;

// Load GrovePI Sensor Config
const sensorConfig = require('./sensor-config.js');
console.log('sensorConfig = ', sensorConfig);

// Current Sensor Values - collected from "sensor-config.js" file
var currentData = {};
/*
var currentData = {
    button: false,
    sound: 0,
    angle: 0,
    lightLevel: 0,
    range: 0,
    temperature: 0,
    humidity: 0,
    heatIndex: 0,
    buzzer: false,
    led: false
};
*/

//    host: '192.168.20.251',
// Setup MQTT broker connection
const mqtt = require("mqtt");
var options = {
    port: 1883,
    host: 'localhost',
    clientId: 'raspberrypi3-oc',
    username: 'iotuser',
    password: 'iotpass',
    keepalive: 43200,
    reconnectPeriod: 30000,
    clean: true,
    encoding: 'utf8'
};

var mqttClient = mqtt.connect(options);

mqttClient.on('connect', function() {
        console.log("mqtt client connected");

        // subscribe to 'iotcs-oc' topic
        mqttClient.subscribe('iotcs-oc', function() {
            console.log("subscribed to iotcs topic");

            // listen for message
            mqttClient.on('message', function(topic, message, packet) {
                console.log("received '" + message + "'");
                currentData['message'] = message + " - Hello IoT World";
                dataChange();
            });
        });
});

mqttClient.on('error', function(err){
        console.log("Connection to MQTT broker failure: ", err);
});
// RXIE: mqtt communication done


const device = new iotClient.device.DirectlyConnectedDevice();

// Virtual Device;
var virtualDev;

//
// Main entry point of execution
// Setup device and board and initialize them
activateDeviceIfNeeded(device)
    .then((device) => {
    	console.log( 'device: ', device);
        return getModelGrovePiDeviceModel(device);
    })
    .then((deviceModel) => {
    	console.log( 'device model: ', deviceModel);
        virtualDev = device.createVirtualDevice(device.getEndpointId(), deviceModel);
        return createGrovePiBoard(virtualDev);
    })
    .then((board) => {
        return setupSensors();
    })
    .catch(err => {
        console.log('err = ', err);
    });

/**
 * Create Grove Pi Board and initialize it
 *
 * @returns {Promise} that completes when the board has been initialized
 */
function createGrovePiBoard() {
    return new Promise((resolve, reject) => {
        var board = new Board({
            debug: true,
            onError: function (err) {
                reject('Something went wrong with grove pi init. Err:'+err);
            },
            onInit: function (res) {
                if (res) {
                    resolve(board);
                } else {
                    reject('Init failed')
                }
            }
        });
        board.init();
    });
}

// let a = new Digital(4);
// a.write(true);

function setupSensors() {
    let writableSensors = {};

    virtualDev.onChange = tupples => {
        tupples.forEach(tupple => {
            var show = {
                name: tupple.attribute.id,
                lastUpdate: tupple.attribute.lastUpdate,
                oldValue: tupple.oldValue,
                newValue: tupple.newValue
            };
            console.log('------------------ON VIRTUAL DEVICE CHANGE ---------------------');
            console.log(JSON.stringify(show, null, 4));
            console.log('----------------------------------------------------------------');
            if (writableSensors[tupple.attribute.id]) writableSensors[tupple.attribute.id].write(tupple.newValue);
            // sensor[tupple.attribute.id] = tupple.newValue;
        });
    };

    sensorConfig.forEach(sensor => {
        var pinMatch = sensor.pin.match(/([AD])(\d+)/);
        var isAnalog = pinMatch[1] === 'A';
        var pin = parseInt(pinMatch[2]);

        // initialize sensor data
        if( sensor.attr !== null ) {
            currentData[sensor.attr] = sensor.val;
        }

        switch (sensor.type) {
            case 'TemperatureAndHumiditySensor':
                let tempHumSensor = new DHTDigitalSensor(pin,DHTDigitalSensor.VERSION.DHT11,DHTDigitalSensor.CELSIUS);
                tempHumSensor.stream(200, function(res) {
                    if (res) {
                        let change = false;
                        if (res[0] !== currentData['temperature']) {
                            currentData['temperature'] = res[0];
                            change = true;
                        }
                        if (res[1] !== currentData['humidity']) {
                            currentData['humidity'] = res[1];
                            change = true;
                        }
                        if (res[2] !== currentData['heatIndex']) {
                            currentData['heatIndex'] = res[2];
                            change = true;
                        }
                        // if (change) dataChange();
                    }
                    // console.log('TemperatureAndHumiditySensor temp = ', temp,'hum = ', hum,'heatIndex = ', heatIndex);
                });
                break;

            case 'LightAnalogSensor':
                new LightAnalogSensor(pin).stream(1000, function(res) {
                    if (res !== currentData[sensor.attr] && res !== false) {
                    	if (Math.abs(res- currentData[sensor.attr]) > 20 ) {
                        	currentData[sensor.attr] = res;
console.log('light change');
                        	dataChange();
            			}
                    }
                });
                break;

            case 'Button':
                new Digital(pin).stream(200, function(res) {
		var resValue = true;
		if( res !== false && res === 0 ) {
			resValue = false;
		}

                    if (resValue !== currentData[sensor.attr] ) {
                        currentData[sensor.attr] = resValue;
console.log('button change');
                        dataChange();
                    }
                });
                break;

            case 'UltrasonicRanger':
                new UltrasonicDigitalSensor(pin).stream(100, function(res) {
                    if (res !== currentData['range'] && res !== false) {
                        currentData['range'] = res;
                        dataChange();
                    }
                });
                break;

            case 'SoundAnalogSensor':
                new Analog(pin).stream(100, function(res) {
                    if (res !== currentData['sound'] && res !== false) {
                        currentData['sound'] = res;
                        dataChange();
                    }
                });
                break;

            case 'RotaryAngleAnalogSensor':
                new Analog(pin).stream(500, function(res) {
                    if (res !== currentData[sensor.attr] && res !== false) {
		              // RXIE: filter out little noise
                      if (Math.abs(res- currentData[sensor.attr]) > 5 ) {
                  			currentData[sensor.attr] = res;
console.log('angle change');
                        dataChange();
                      }
                    }
                });
                break;

            case 'LEDSocketKit':
                writableSensors['led'] = new Digital(pin);
                break;

            case 'Buzzer':
                writableSensors['buzzer'] = new Digital(pin);
                break;
        }
    });
}


function dataChange() {
    console.log('updateChange() - currentData = ', currentData);
    virtualDev.update(currentData);
}


function getModelGrovePiDeviceModel(device){
    return new Promise((resolve, reject) => {
        device.getDeviceModel(DEVICE_MODEL_URN, function (response) {
            resolve(response);
            // humidityModel = response;
            // startVirtualHumidity(device, device.getEndpointId());
        });
    });
}

function activateDeviceIfNeeded(device) {
    return new Promise((resolve, reject) => {
        if (device.isActivated()) {
            resolve(device);
        } else {
            device.activate([DEVICE_MODEL_URN], () => {
                console.log('Activated device ',device.getEndpointId(),device.isActivated());
                if (device.isActivated()) {
                    resolve(device);
                } else {
                    reject('Failed to activate device')
                }
            });
        }
    });
}
