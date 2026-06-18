// app/+html.tsx
import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        
        {/* Preconnect to Google Fonts for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Load Outfit font for display headings */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" 
          rel="stylesheet" 
        />
        
        {/* Viewport with proper scaling */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        
        {/* Theme color for browser UI */}
        <meta name="theme-color" content="#DE6B48" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0F172A" />
        
        {/* Apple meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
        {/* Disable body scrolling on web */}
        <ScrollViewStyleReset />

        {/* Inline CSS for initial load to prevent flicker */}
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyles = `
  /* CSS Variables for initial paint */
  :root {
    --color-background: #FDFCFB;
    --color-text: #1C1917;
  }

  /* Prevent scrollbar from causing layout shifts */
  html {
    overflow: hidden;
    height: 100%;
  }

  body {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background-color: var(--color-background);
    color: var(--color-text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Root div styling */
  #root {
    display: flex;
    flex: 1;
    height: 100%;
  }

  /* Dark mode initial load */
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background: #0F172A;
      --color-text: #F8FAFC;
    }
  }

  /* Remove tap highlight on mobile */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  /* Selection styling */
  ::selection {
    background-color: rgba(222, 107, 72, 0.2);
    color: inherit;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }

  @media (prefers-color-scheme: dark) {
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }

  /* Focus visible */
  :focus-visible {
    outline: 2px solid #DE6B48;
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

// import { ScrollViewStyleReset } from 'expo-router/html'

// // This file is web-only and used to configure the root HTML for every
// // web page during static rendering.
// // The contents of this function only run in Node.js environments and
// // do not have access to the DOM or browser APIs.
// export default function Root({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <head>
//         <meta charSet="utf-8" />
//         <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

//         {/*
//           This viewport disables scaling which makes the mobile website act more like a native app.
//           However this does reduce built-in accessibility. If you want to enable scaling, use this instead:
//             <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
//         */}
//         <meta
//           name="viewport"
//           content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1.00001,viewport-fit=cover"
//         />
//         {/*
//           Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
//           However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
//         */}
//         <ScrollViewStyleReset />

//         {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
//         <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
//         {/* Add any additional <head> elements that you want globally available on web... */}
//       </head>
//       <body>{children}</body>
//     </html>
//   )
// }

// const responsiveBackground = `
// body {
//   background-color: #fff;
// }
// @media (prefers-color-scheme: dark) {
//   body {
//     background-color: #000;
//   }
// }`
