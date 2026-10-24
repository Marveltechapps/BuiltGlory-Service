export const CITY_POINTS = [
  { city: "Ahmedabad", state: "Gujarat", latitude: 23.03, longitude: 72.58 },
  { city: "Bangalore", state: "Karnataka", latitude: 12.97, longitude: 77.59 },
  { city: "Chennai", state: "Tamil Nadu", latitude: 13.08, longitude: 80.27 },
  { city: "Coimbatore", state: "Tamil Nadu", latitude: 11.02, longitude: 76.96 },
  { city: "Delhi", state: "Delhi", latitude: 28.61, longitude: 77.21 },
  { city: "Hyderabad", state: "Telangana", latitude: 17.38, longitude: 78.48 },
  { city: "Jaipur", state: "Rajasthan", latitude: 26.91, longitude: 75.79 },
  { city: "Kolkata", state: "West Bengal", latitude: 22.57, longitude: 88.36 },
  { city: "Mumbai", state: "Maharashtra", latitude: 19.08, longitude: 72.88 },
  { city: "Pune", state: "Maharashtra", latitude: 18.52, longitude: 73.86 },
  { city: "Surat", state: "Gujarat", latitude: 21.17, longitude: 72.83 },
  { city: "Thiruvananthapuram", state: "Kerala", latitude: 8.52, longitude: 76.94 },
  { city: "Kochi", state: "Kerala", latitude: 9.93, longitude: 76.27 },
  { city: "Chandigarh", state: "Chandigarh", latitude: 30.73, longitude: 76.78 }
];

export const nearestCity = (latitude, longitude) => {
  let best = CITY_POINTS[2];
  let min = Infinity;
  for (const point of CITY_POINTS) {
    const distance = (point.latitude - latitude) ** 2 + (point.longitude - longitude) ** 2;
    if (distance < min) {
      min = distance;
      best = point;
    }
  }
  return { city: best.city, state: best.state, country: "India", latitude, longitude };
};
