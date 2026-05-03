export interface VehicleEvent {
  vehicle_plate: string;
  type: 'Emergency' | 'Position';
  coordinates: {
    latitude: string;
    longitude: string;
  };
  status: string;
  timestamp: string;
  eventId: string;
  receivedAt?: string;
}
