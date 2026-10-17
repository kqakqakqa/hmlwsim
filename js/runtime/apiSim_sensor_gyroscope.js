const ApiSimSensorGyroscope = {
  subscribeGyroscope: callbacks => DeviceFeatureSensor.subscribe('gyroscope', callbacks && callbacks.success),
  unsubscribeGyroscope: () => DeviceFeatureSensor.unsubscribe('gyroscope'),
};
