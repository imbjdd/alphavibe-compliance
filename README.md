# EU Compliance Checker

A web application that analyzes websites for compliance with European laws including GDPR, e-Privacy, and other regulations. This tool scrapes target websites, analyzes their compliance texts, and provides detailed reports.

## Features

- **Website Scraping**: Automatically extracts Terms of Service, Privacy Policy, and Cookie Policy content
- **Compliance Analysis**: Checks extracted content against European regulations
- **Detailed Reports**: Shows compliance scores, identifies issues, and provides recommendations
- **Responsive UI**: Works on both desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js with Tailwind CSS
- **Backend**: Next.js API routes
- **Scraping**: Playwright (headless browser automation)
- **Analysis**: Internal service that checks text against regulatory requirements

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/compliance-checker.git
cd compliance-checker
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Project Structure

- `/app` - Next.js app router pages and layouts
- `/components` - Reusable React components
- `/services` - Backend services for scraping and analysis
- `/types` - TypeScript type definitions
- `/public` - Static assets

## How It Works

1. User enters a website URL in the home page
2. The application uses Playwright to scrape the website's compliance-related content
3. Scraped content is analyzed against a set of rules based on European laws
4. A detailed report is generated showing compliance status, issues found, and recommendations

## Note

This is a demo version with mock analysis. In a production environment, you would integrate with a more sophisticated compliance analysis service.

## License

MIT
