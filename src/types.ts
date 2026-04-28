export interface VehicleEvent {
  vehicleId: string;
  type: 'Emergency' | 'Position';
  latitude?: number;
  longitude?: number;
  timestamp: string;
  eventId: string;
  receivedAt?: string;
}
