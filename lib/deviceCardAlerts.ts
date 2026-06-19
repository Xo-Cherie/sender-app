export type DeviceNewCardAlert = {
  cardId: string;
  title: string;
  body: string;
};

type DeviceNewCardAlertListener = (alert: DeviceNewCardAlert) => void;

const listeners = new Set<DeviceNewCardAlertListener>();

export function subscribeDeviceNewCardAlerts(listener: DeviceNewCardAlertListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDeviceNewCardAlert(alert: DeviceNewCardAlert) {
  listeners.forEach((listener) => listener(alert));
}
