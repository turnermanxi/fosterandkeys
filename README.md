# Foster & Keys — Apartment Matching Automation System

Real estate lead processing and apartment/unit matching automation powered by **OpenAI**.

This system automatically processes incoming client inquiries, extracts housing requirements using AI, scores available apartments against client needs, and generates a personalized results page for agents to share with clients.

Pipeline

Gmail (IMAP)
↓
AI Email Parsing
↓
Supabase Database
↓
Apartment Match Scoring
↓
Agent Dashboard Review
↓
Client Results Page

---

# Overview

The **Foster & Keys Apartment Matching System** was built to automate the manual workflow real estate agents typically perform when matching clients with available apartments.

Instead of manually reading intake emails and searching listings, this system:

- parses client emails using **AI**
- extracts housing requirements
- scores all available units against client needs
- generates a **ranked list of best matches**
- creates a **shareable client results page**

Agents can review results through a dashboard before sending matches to the client.

---

# Problem

Real estate agents often receive client inquiries via email that contain unstructured information about housing needs.

Typical workflow:

1. Agent reads email
2. Extracts client requirements manually
3. Searches available apartment units
4. Determines best matches
5. Sends recommendations to client

This process is **slow, repetitive, and difficult to scale**.

---

# Solution

This system automates the entire lead intake and matching workflow using AI and a structured database pipeline.

When a new client inquiry email arrives:

1. The system polls Gmail via **IMAP**
2. **OpenAI parses the email** and extracts structured lead information
3. Lead data is stored in **Supabase**
4. Available apartment units are **scored against client requirements**
5. OpenAI generates a **human-readable match summary**
6. Results appear in the **agent dashboard**
7. Agent can send a **unique client results page**

The system drastically reduces manual lead processing time.

---

# Features

## AI Email Parsing

OpenAI automatically extracts structured lead information from raw email bodies.

Extracted fields include:

- Client name
- Email
- Budget
- Preferred location
- Bedrooms
- Bathrooms
- Move-in timeline
- Additional preferences

This removes the need for rigid intake forms.

---

## Apartment Matching Engine

Each apartment/unit is scored against the client profile based on:

- price compatibility
- location preferences
- bedroom/bath requirements
- availability

The system generates a **ranked list of best matching units**.

---

## AI Match Summary

OpenAI generates a **3–5 sentence summary** explaining why the selected apartments match the client’s needs.

This appears on:

- Agent dashboard
- Client results page

---

## Agent Dashboard

Agents can review leads and matches before sending results to clients.

Dashboard capabilities include:

- View parsed client information
- Review AI-generated summaries
- Review ranked apartment matches
- Send results to client

---

## Client Results Page

Each lead generates a **secure results page** with a unique token.

Example:

/results/[token]

Clients can view:

- AI summary of their housing needs
- Recommended apartments
- unit details and pricing

---

# Architecture

┌──────────────┐    IMAP poll   ┌───────────────────┐   OpenAI     ┌──────────┐
│    Gmail     │ ◀─────────────│  /api/cron/       │ ──parses──▶ │ Supabase │
│   Inbox      │   fetch unread │   check-email     │  lead + scores│  DB     │
└──────────────┘                └───────────────────┘              └──────────┘
                                        │                              │
                                        │  1. OpenAI extracts fields   │
                                        │  2. scores lead vs all units │
                                        │  3. OpenAI writes summary    │
                                        ▼                              │
                               ┌───────────────────┐                   │
                               │  Agent Dashboard  │◀──── reads ──────┘
                               │  /dashboard       │
                               └───────────────────┘
                                        │
                                        │  "Send to Client" button
                                        ▼
                               ┌───────────────────┐
                               │  Client Results   │
                               │  /results/[token] │
                               └───────────────────┘

---

# Tech Stack

## Backend
- Node.js
- Express

## Database
- Supabase (PostgreSQL)

## AI Integration
- OpenAI API
- GPT-4o-mini

## Email Processing
- Gmail IMAP

## Frontend
- Agent dashboard
- Client results page

---

# Workflow

## 1. Email Intake

The system polls Gmail for unread emails containing client housing inquiries.

## 2. AI Parsing

OpenAI extracts structured data from the email body.

Example fields extracted:

name  
email  
budget  
location  
beds  
baths  
move-in date  
notes  

## 3. Lead Storage

Parsed data is stored in **Supabase**.

## 4. Apartment Matching

All apartment units are scored against the client profile.

## 5. AI Summary

OpenAI generates a personalized explanation of the recommended matches.

## 6. Agent Review

The agent dashboard allows reviewing the matches before sending them to the client.

## 7. Client Results Page

A secure link is generated with recommended apartments.

---

# Screenshots

(Add screenshots here once available)

### Agent Dashboard
[screenshot here]

### AI Parsed Lead Data
[screenshot here]

### Apartment Match Results
[screenshot here]

### Client Results Page
[screenshot here]

---

# Future Improvements

Potential enhancements include:

- MLS / apartment listing API integrations
- advanced scoring algorithms
- automated follow-up email sequences
- analytics for lead conversion
- CRM integration

---

# Author

Developed by **Christopher Turner**  
Kinexis Automation Systems

---

# License

Private project — internal client automation system.
