const mongoose = require('mongoose');

// Connect to MongoDB using Mongoose
const connectDB = async (uri) => {
    try {
        // Connect to the database
        await mongoose.connect(uri);
        console.log('Connected to MongoDB successfully!');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1); // Exit the process if connection fails
    }
};

// Export the connection function
module.exports = { connectDB };
