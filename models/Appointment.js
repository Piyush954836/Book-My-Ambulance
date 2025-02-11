const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Add this field
  patientName: { type: String, required: true },
  contact: { type: String, required: true },
  age: { type: Number, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Accepted", "Declined"], default: "Pending" },
}, { timestamps: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
