const ApiSimSensorCompass = {
  subscribeCompass: callbacks => DeviceFeatureSensor.subscribe('compass', callbacks && callbacks.success),
  unsubscribeCompass: () => DeviceFeatureSensor.unsubscribe('compass'),
};
