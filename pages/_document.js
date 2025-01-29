import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="stylesheet" href="https://unpkg.com/@salesforce-ux/design-system@2.17.5/assets/styles/salesforce-lightning-design-system.min.css" />
        <style>
          {`
            @font-face {
              font-family: 'HelveticaNeue-Condensed';
              src: url('https://jarrang-font.s3.eu-west-2.amazonaws.com/milwaukee/HelveticaNeue-Condensed+Bold.ttf') format('truetype');
              font-weight: bold;
              font-style: normal;
              font-display: swap;
            }
          `}
        </style>
      </Head>
      <body>
        <svg xmlns="http://www.w3.org/2000/svg" className="slds-hidden svg-sprite">
          <symbol id="chevrondown" viewBox="0 0 52 52">
            <path fill="inherit" d="M47.6 17.8L27.1 38.5c-.6.6-1.6.6-2.2 0L4.4 17.8c-.6-.6-.6-1.6 0-2.2l2.2-2.2c.6-.6 1.6-.6 2.2 0l16.1 16.3c.6.6 1.6.6 2.2 0l16.1-16.3c.6-.6 1.6-.6 2.2 0l2.2 2.2c.5.6.5 1.6 0 2.2z" />
          </symbol>
          <symbol id="close" viewBox="0 0 52 52">
            <path fill="inherit" d="M31.6 25.8l13.1-13.1c.6-.6.6-1.5 0-2.1l-2.1-2.1c-.6-.6-1.5-.6-2.1 0L27.4 21.6c-.4.4-1 .4-1.4 0L12.9 8.4c-.6-.6-1.5-.6-2.1 0l-2.1 2.1c-.6.6-.6 1.5 0 2.1l13.1 13.1c.4.4.4 1 0 1.4L8.6 40.3c-.6.6-.6 1.5 0 2.1l2.1 2.1c.6.6 1.5.6 2.1 0L26 31.4c.4-.4 1-.4 1.4 0l13.1 13.1c.6.6 1.5.6 2.1 0l2.1-2.1c.6-.6.6-1.5 0-2.1L31.6 27.2c-.4-.4-.4-1 0-1.4z"/>
          </symbol>
        </svg>
        <div className="slds-scope">
          <Main />
          <NextScript />
        </div>
      </body>
    </Html>
  );
}
