const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export async function getReservations() {
  const response = await fetch(`${API_BASE_URL}/reservations`);
  return response.json();
}
