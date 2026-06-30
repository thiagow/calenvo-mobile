const session = {
  user: { id: 'test-user-id' }
};

const testData = {
  name: "Test Schedule",
  description: "Test description",
  color: "#3B82F6",
  workingDays: [1, 2, 3, 4, 5],
  startTime: "08:00",
  endTime: "18:00",
  slotDuration: 30,
  bufferTime: 0,
  lunchStart: "",
  lunchEnd: "",
  advanceBookingDays: 30,
  minNoticeHours: 2,
  serviceIds: []
};

console.log('Test data:', JSON.stringify(testData, null, 2));
