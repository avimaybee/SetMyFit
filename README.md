# What2Wear: Your Personal AI Stylist

What2Wear is a context-aware, highly personalized, daily decision engine for your outfits. It's not just another weather app; it's a sophisticated AI-powered stylist that learns your preferences and helps you make the most of your wardrobe.

## Vision

Our vision is to eliminate the daily "what to wear" dilemma. We aim to create a seamless and enjoyable experience for users to manage their wardrobe, discover new styles, and feel confident in their clothing choices every day. We believe that by leveraging the power of AI and machine learning, we can provide a truly personalized and valuable service to our users.

## Features

### Core Features

*   **Virtual Wardrobe:** Easily add, categorize, and manage your clothing items. You can upload images, add details like brand, color, and material, and even track the last time you wore an item.
*   **Context-Aware Recommendations:** Our recommendation engine takes into account multiple factors to suggest the perfect outfit:
    *   **Weather:** Real-time weather data, including temperature, humidity, and chance of precipitation.
*   **Personalized Suggestions:** Our machine learning models learn your style preferences over time. The more you use the app and provide feedback on the recommendations, the better it gets at suggesting outfits you'll love.
*   **Outfit Logging:** Keep a visual diary of your daily outfits. This helps you track your style evolution and avoid repeating outfits too often.

### Advanced Features

*   **Smart Closet Analysis:** Get insights into your wardrobe, such as which items you wear the most and which ones you haven't worn in a while.
*   **Style Discovery:** Discover new outfit combinations and styles based on your existing wardrobe.
*   **Travel Packing Lists:** The app can help you pack for trips by suggesting a wardrobe based on your destination's weather and your planned activities.

## System Architecture

What2Wear is built on a modern, scalable, and serverless architecture.

*   **Frontend:** The frontend is a Next.js application built with React and TypeScript. It uses Tailwind CSS for styling and shadcn/ui for UI components. The app is designed to be fully responsive and work seamlessly on all devices.
*   **Backend:** The backend is powered by Supabase, a backend-as-a-service platform that provides a PostgreSQL database, authentication, and instant APIs.
*   **Serverless Functions:** We use Supabase Functions for our serverless logic, such as the daily outfit recommender and creating outfits.

## Machine Learning Models

Our recommendation engine uses a combination of machine learning models to provide personalized suggestions:

*   **Preference Learning:** We use a preference learning model to understand your style. This model takes your feedback on recommended outfits and learns what you like and dislike.
*   **Recommendation Engine:** The core of our recommendation system, this engine combines all the inputs (weather, user preferences) to generate the final outfit recommendations.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18 or later)
*   npm
*   Docker (for running Supabase locally)

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/avimaybee/what2wear.git
    ```
2.  Install NPM packages
    ```sh
    cd what2wear/app
    npm install
    ```
3.  Set up Supabase
    *   Install the Supabase CLI: `npm install -g supabase`
    *   Start the local Supabase services: `supabase start`
    *   Copy the environment variables from the Supabase CLI output and add them to a `.env.local` file in the `app` directory.
        ```
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API Reference

The API endpoints are located in `src/app/api`. Each endpoint is responsible for a specific feature:

*   `/api/outfit/log`: Logs daily outfits.
*   `/api/recommendation/[id]/feedback`: Handles feedback for recommendations.
*   `/api/settings/profile`: Manages user profiles.
*   `/api/wardrobe`: Manages the user's wardrobe.
*   `/api/weather`: Fetches weather data.

## Database Schema

The database schema is defined in the `supabase/schema.sql` file. It includes the following tables:

*   `users`: Stores user information.
*   `wardrobe_items`: Stores information about each clothing item.
*   `outfits`: Stores information about created outfits.
*   `outfit_items`: A join table between `outfits` and `wardrobe_items`.
*   `recommendations`: Stores the outfit recommendations for each user.
*   `feedback`: Stores user feedback on recommendations.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## Deployment

This app is designed to be deployed on [Vercel](https://vercel.com/), the platform from the creators of Next.js.
