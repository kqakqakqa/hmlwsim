const ApiSimSensorBarometer = {
  subscribeBarometer: callbacks => DeviceFeatureSensor.subscribe('barometer', callbacks && callbacks.success),
  unsubscribeBarometer: () => DeviceFeatureSensor.unsubscribe('barometer'),
};
