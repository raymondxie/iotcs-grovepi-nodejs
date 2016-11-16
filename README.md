# iotcs-grovepi-nodejs
Starter device client code in NodeJS, for a Raspberry Pi device with GrovePi sensors, to communicate with Oracle IoT Cloud Service

## Sensor Configuration
You can configure the sensors connected to GrovePi ports, and map them to the data attribute defined in device model.

>  {
>    "pin": "A2",
>    "type": "LightAnalogSensor",
>    "attr": "light",
>    "val": 0.0
>  }

Basically it says: A light sensor is hooked on A2 port, and the reading is associated with "light" attribute in device model, with attribute value initialized to 0.0

## Start Device Client program
Just type at command line of Raspberry Pi:

> node mainClient.js provisioning-file-name file-password

