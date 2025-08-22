import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Multitag script - server-rendered for proper detection */}
        <script src="https://fpyf8.com/88/tag.min.js" data-zone="165368" async data-cfasync="false"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
