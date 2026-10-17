/**
 * API Sim: system.sensor
 * Application-facing API for sensor subscriptions.
 * Delegates to DeviceFeatureSensor.
 */
const ApiSimSensor = Object.assign(
  {},
  ApiSimSensorAccelerometer,
  ApiSimSensorGyroscope,
  ApiSimSensorCompass,
  ApiSimSensorStepCounter,
  ApiSimSensorBarometer,
  ApiSimSensorHeartRate,
  ApiSimSensorOnBodyState,
);
