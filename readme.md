# Garapin POS - Backend API

A Node.js/Express backend service for the Garapin POS system, providing core API functionality for the point of sale application.

## Overview

This backend service handles all the server-side logic for the Garapin POS system, including user authentication, product management, transaction processing, and payment integration. It uses a MongoDB database for data storage and provides RESTful API endpoints for the frontend applications.

## Key Features

- **Authentication System**: User registration, login, OTP verification
- **Product Management**: CRUD operations for products, categories, and inventory
- **Transaction Processing**: Complete order lifecycle management
- **Payment Integration**: Xendit integration for payment processing
- **Split Payment System**: Advanced payment distribution system
- **Webhook Handlers**: Endpoints for payment service callbacks
- **Reporting Services**: Data aggregation for business reports

## Project Structure

```
/src
  /config/       # Database and environment configuration
  /controllers/  # Business logic for API endpoints
  /models/       # MongoDB schemas and models
  /routes/       # API route definitions
  /scheduler/    # Scheduled tasks and jobs
  /schema/       # Data validation schemas
  /utils/        # Utility functions and helpers
  app.js         # Application entry point
```

## Technical Details

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based authentication
- **Validation**: Express-validator and Zod
- **Payment**: Xendit integration for payment processing
- **Email**: SendGrid/Nodemailer for email communications

## Split Payment System

The backend implements a sophisticated payment distribution system that:

1. Manages templates for how transactions should be split among participants
2. Handles complex percentage-based calculations for revenue and fee sharing
3. Creates and manages split payment rules in Xendit
4. Tracks all transaction splits and transfers
5. Supports hierarchical distributions through parent-child relationships
6. Provides dedicated APIs for configuring and monitoring payment splits

## Multi-Tenant Architecture

The system uses a database-per-tenant approach:

- Each merchant/store has its own MongoDB database
- The `target-database` header identifies which database to use for each request
- Parent-child relationships can be established between databases
- Cross-database queries are supported for consolidated operations

## API Endpoints

Major endpoint groups include:

- `/auth/*` - Authentication endpoints
- `/webhook_va/*` - Payment gateway webhooks
- `/product/*` - Product management
- `/store/*` - Store configuration
- `/transactions/*` - Transaction management
- `/report/*` - Reporting endpoints
- `/store/split_rule` - Split payment configuration

## Setup and Installation

1. Ensure Node.js (v14+) and MongoDB are installed
2. Clone the repository
3. Run `npm install` to install dependencies
4. Configure environment variables in `.env` file
5. Run `npm run dev` to start development server

## Dependencies

Key dependencies include:
- express: ^4.18.2
- mongoose: ^6.12.6
- jsonwebtoken: ^9.0.2
- bcrypt: ^5.1.1
- xendit-node: ^5.0.0
- node-cron: ^3.0.3
- axios: ^1.6.7

1. set callback url di dashboard setting webhook
2. https://5c5d-180-244-163-145.ngrok-free.app/webhook_va/CREATED
3. https://5c5d-180-244-163-145.ngrok-free.app/webhook_va/PAID

4. baseurl/webhook_va/{CREATED/PAID}

5. simulasi create invoices dengan nama invoices yang sama dengan test webhook didashboard yang dikirim xendit
6. klik test fva CREATED untuk ubah status va menjadi aktif dan bisa di bayar
7. klik test fva PAID untuk ubah status va menjadi PAID dan didatabase menjadi Sukses
