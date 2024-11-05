const express = require('express');
const mysql = require('mysql2/promise'); // MySQL client with async support
const axios = require('axios'); // For making API calls to the ML model
require('dotenv').config();

const app = express();
const port = 8080;

// Set up your MySQL database connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Stiles!1',
  database: 'message_classification',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Function to classify messages using OpenAI API
async function classifyMessage(message) {
  try {
    const response = await axios.post(
      process.env.MODEL_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a text classifier. Classify messages as either 'Transactional' or 'Promotional'." },
          { role: "user", content: `Classify this message: "${message}"` }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.MODEL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const classifiedLabel = response.data.choices[0].message.content.trim();
    return classifiedLabel.includes("Promotional") ? "Promotional" : "Transactional";
  } catch (error) {
    console.error("Error in message classification:", error);
    return null;
  }
}

// Function to check for misuse based on sender ID type
async function findMisusedSenderIDs() {
  try {
    const [messages] = await pool.query('SELECT sender_id, message, expected_type FROM messages');

    const misusedSenders = [];
    
    for (const { sender_id, message, expected_type } of messages) {
      const classifiedType = await classifyMessage(message);

      // Check if the classified type doesn't match the expected type
      if (classifiedType && classifiedType !== expected_type) {
        misusedSenders.push({
          sender_id,
          message,
          classifiedType,
          expectedType: expected_type,
        });
      }
    }

    return misusedSenders;
  } catch (error) {
    console.error("Error finding misused sender IDs:", error);
    return [];
  }
}

// Define a route to get misused sender IDs
app.get('/misused-senders', async (req, res) => {
  const misusedSenders = await findMisusedSenderIDs();
  res.json({ misusedSenders });
});
console.log("API Key:", process.env.MODEL_API_KEY);


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
