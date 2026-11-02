# ProtoBot: Rover Protocol

Een Nederlandstalig programmeerspel voor 12–16 jaar. Programmeer ProtoBot met blokken en vind een veilige route naar de eindtegel.

## Ontwikkelen

Gebruik Node.js 26 LTS en npm. Voer `npm ci` uit en start met `npm run dev`. `npm run build` controleert TypeScript en bouwt de statische site in `dist/`.

Het startproject toont de technische basis. De blokeditor, interpreter en missies volgen volgens [het technisch ontwerp](docs/technisch-ontwerp.md).

De workflow controleert de build bij een push of pull request. Om te publiceren: kies GitHub Actions bij Settings → Pages en start de Pages-workflow handmatig vanaf main.
