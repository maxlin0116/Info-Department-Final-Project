const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export async function getAreas() {
  const response = await fetch(`${API_BASE_URL}/areas`);
  return response.json();
}
