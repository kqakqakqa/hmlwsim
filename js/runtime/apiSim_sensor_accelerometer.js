const ApiSimSensorAccelerometer = {
  subscribeAccelerometer: callbacks => DeviceFeatureSensor.subscribe('accelerometer', callbacks && callbacks.success),
  unsubscribeAccelerometer: () => DeviceFeatureSensor.unsubscribe('accelerometer'),
};
