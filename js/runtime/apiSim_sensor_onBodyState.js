const ApiSimSensorOnBodyState = {
  subscribeOnBodyState: callbacks => DeviceFeatureSensor.subscribe('onBodyState', callbacks && callbacks.success),
  unsubscribeOnBodyState: () => DeviceFeatureSensor.unsubscribe('onBodyState'),
  getOnBodyState: callbacks => {
    callbacks = callbacks || {};
    if (typeof callbacks.success === 'function') callbacks.success(DeviceFeatureSensor.getSensorValue('onBodyState'));
    if (typeof callbacks.complete === 'function') callbacks.complete();
  },
};
