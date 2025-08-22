import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Multitag script will be loaded conditionally by AdScript component */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
