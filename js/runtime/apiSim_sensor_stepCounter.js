const ApiSimSensorStepCounter = {
  subscribeStepCounter: callbacks => DeviceFeatureSensor.subscribe('stepCounter', callbacks && callbacks.success),
  unsubscribeStepCounter: () => DeviceFeatureSensor.unsubscribe('stepCounter'),
};
