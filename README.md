# PillCare Reminder - Medication Management Application

A comprehensive medication reminder and health tracking application built with React Native (Expo) and FastAPI.

## 🚀 Features

- **Medication Management**: Track multiple medications with customizable schedules
- **Dose Tracking**: Mark medications as taken, skipped, or missed
- **Health Measurements**: Log blood pressure, glucose, heart rate, and more
- **Activity Tracking**: Monitor steps, exercise, water intake, and sleep
- **Mood Logging**: Track daily mood with notes
- **AI-Powered Features**:
  - Daily motivational messages based on adherence
  - Medication scanner (extract info from photos)
  - Brand to generic name resolution
- **Caregiver Alerts**: Notify caregivers of skipped medications or low stock
- **Progress Dashboard**: Visualize adherence trends and health metrics
- **Privacy-First**: AES-256 encryption, local-first architecture

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **Python**: 3.11 or higher
- **MongoDB**: 5.0 or higher
- **Expo CLI**: Latest version
- **iOS/Android development environment** (for mobile testing)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ntnr737/Pillcare-Reminder_V01.git
cd Pillcare-Reminder_V01
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

Edit `backend/.env` with your configuration:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=pillcare
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=your_32_char_secret_key
ALLOWED_ORIGINS=http://localhost:8081,exp://192.168.1.100:8081
```

**Get API Keys:**
- **Groq API**: Sign up at [console.groq.com](https://console.groq.com)
- **MongoDB**: Install locally or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies (using yarn - recommended)
yarn install

# Create environment file
cp .env.example .env
```

Edit `frontend/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8080
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

**Setup Firebase (Optional but Recommended):**
1. Create a project at [Firebase Console](https://console.firebase.com)
2. Add a web app to get configuration
3. Enable Authentication (if using auth features)
4. Copy credentials to `.env`

## 🚀 Running the Application

### Start Backend Server

```bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8080
```

Backend will be available at `http://localhost:8080`

### Start Frontend (Mobile)

```bash
cd frontend
yarn start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

### Access API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8080/docs
- **ReDoc**: http://localhost:8080/redoc

## 📱 Project Structure

```
Pillcare-Reminder_V01/
├── frontend/                 # React Native (Expo) application
│   ├── app/                 # App screens and navigation
│   │   ├── (tabs)/         # Bottom tab navigator screens
│   │   ├── index.tsx       # Entry screen
│   │   └── _layout.tsx     # Root layout
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── lib/           # Core utilities (API, theme, Firebase)
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Helper functions
│   ├── package.json
│   └── .env.example
│
├── backend/                 # FastAPI server
│   ├── server.py           # Main API application
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile         # Container configuration
│   └── .env.example
│
├── agent/                   # Autonomous monitoring (experimental)
│   ├── chief_engineer.py  # Self-healing agent
│   ├── monitor.py         # Health checks
│   └── tools.py           # Agent utilities
│
├── design_guidelines.json  # UI/UX specifications
└── README.md              # This file
```

## 🔐 Security Features

### Current Implementation

- ✅ Environment variable configuration
- ✅ Input validation on API endpoints
- ✅ CORS protection with allowed origins
- ✅ Secure MongoDB queries (no injection)
- ✅ Rate limiting on API endpoints
- ✅ HTTPS support (production)

### Recommended for Production

- [ ] Enable Firebase Authentication
- [ ] Implement JWT token verification
- [ ] Add API key authentication for backend
- [ ] Enable MongoDB field-level encryption
- [ ] Set up SSL certificates
- [ ] Configure Firebase Security Rules
- [ ] Enable audit logging
- [ ] Implement user data isolation

## 🧪 Testing

### Run Backend Tests

```bash
cd backend
pytest tests/ -v
```

### Run Frontend Tests

```bash
cd frontend
yarn test
```

### Manual Testing Checklist

- [ ] Create user profile
- [ ] Add medication with schedule
- [ ] Mark dose as taken
- [ ] View progress dashboard
- [ ] Add health measurement
- [ ] Test AI daily message
- [ ] Test medication scanner
- [ ] Export CSV data

## 📦 Deployment

### Backend Deployment (Google Cloud Run)

```bash
cd backend

# Build container
docker build -t gcr.io/YOUR_PROJECT_ID/pillcare-backend .

# Push to registry
docker push gcr.io/YOUR_PROJECT_ID/pillcare-backend

# Deploy
gcloud run deploy pillcare-backend \
  --image gcr.io/YOUR_PROJECT_ID/pillcare-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Frontend Deployment (Expo EAS)

```bash
cd frontend

# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## 🔧 Configuration

### Environment Variables

#### Backend (`backend/.env`)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGO_URL` | MongoDB connection string | Yes | - |
| `DB_NAME` | Database name | Yes | `pillcare` |
| `GROQ_API_KEY` | Groq AI API key | Yes | - |
| `JWT_SECRET` | Secret for JWT signing | Yes | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | `*` |
| `OPENWA_ENABLED` | Enable WhatsApp alerts | No | `false` |

#### Frontend (`frontend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_BACKEND_URL` | Backend API URL | Yes |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase API key | Yes |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Yes |

## 🎨 Design System

The app follows an **Organic & Earthy dark theme** with accessibility focus:

- **Colors**: Deep forest backgrounds (#121413) with sage accents (#92C5A9)
- **Typography**: Manrope (headings), Work Sans (body)
- **Touch Targets**: Minimum 48x48px
- **Contrast**: WCAG AA compliant (4.5:1)

See `design_guidelines.json` for complete specifications.

## 📚 API Documentation

### Key Endpoints

#### Profile
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Create/update profile

#### Medications
- `GET /api/medications` - List all medications
- `POST /api/medications` - Create medication
- `PATCH /api/medications/{id}` - Update medication
- `DELETE /api/medications/{id}` - Delete medication

#### Doses
- `GET /api/doses?date_str=YYYY-MM-DD` - List doses for date
- `POST /api/doses/{id}/status` - Update dose status

#### AI Features
- `POST /api/scan-medication` - Extract info from image
- `POST /api/resolve-generic` - Get generic name
- `GET /api/ai/daily-message` - Get motivational message

Full API documentation: http://localhost:8080/docs

## 🐛 Troubleshooting

### Backend won't start

**Error: `MONGO_URL environment variable not set`**
- Solution: Create `backend/.env` file with MongoDB connection string

**Error: `ModuleNotFoundError: No module named 'fastapi'`**
- Solution: Activate virtual environment and run `pip install -r requirements.txt`

### Frontend connection issues

**Error: `Network request failed`**
- Check backend is running on `http://localhost:8080`
- Update `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env`
- For physical device, use your computer's IP address

**Error: `Firebase app not initialized`**
- Add Firebase configuration to `frontend/.env`
- Or remove Firebase initialization code if not using

### Build issues

**Error: `Unable to resolve module`**
- Clear cache: `yarn start --clear`
- Delete `node_modules` and reinstall: `rm -rf node_modules && yarn install`

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- **Frontend**: ESLint with Expo config
- **Backend**: Black formatter, isort, flake8
- **TypeScript**: Strict mode enabled

Run linters before committing:

```bash
# Frontend
cd frontend && yarn lint

# Backend
cd backend && black . && isort . && flake8
```

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Expo** - React Native framework
- **FastAPI** - Modern Python web framework
- **Groq** - Fast AI inference
- **MongoDB** - Database
- **Firebase** - Authentication and analytics

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ntnr737/Pillcare-Reminder_V01/issues)
- **Email**: support@pillcare.app
- **Documentation**: [Wiki](https://github.com/ntnr737/Pillcare-Reminder_V01/wiki)

## 🗺️ Roadmap

- [ ] **v1.1**: Multi-language support
- [ ] **v1.2**: Wear OS / watchOS companion apps
- [ ] **v2.0**: Prescription refill integration
- [ ] **v2.1**: Health data export to Apple Health / Google Fit
- [ ] **v3.0**: Telemedicine integration

---

**Built with ❤️ for better medication adherence**

Last Updated: August 2026
