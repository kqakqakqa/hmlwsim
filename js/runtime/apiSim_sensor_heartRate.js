const ApiSimSensorHeartRate = {
  subscribeHeartRate: callbacks => DeviceFeatureSensor.subscribe('heartRate', callbacks && callbacks.success),
  unsubscribeHeartRate: () => DeviceFeatureSensor.unsubscribe('heartRate'),
};
