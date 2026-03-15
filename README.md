# MyScoreboard Card

A Lovelace card for Home Assistant that displays live sports scores from the [MyScoreboard](https://github.com/viktoro/ha-myscoreboard) custom integration.

![MyScoreboard Card](https://raw.githubusercontent.com/viktoro/ha-myscoreboard-card/main/screenshot.png)

## Installation

### HACS (recommended)

1. Add this repository as a custom repository in HACS (category: **Lovelace**)
2. Search for "MyScoreboard Card" and instal
3. Refresh your browser

### Manual

1. Copy `myscoreboard-card.js` to your `config/www/` directory
2. Add it as a resource in your Lovelace config:
   ```yaml
   resources:
     - url: /local/myscoreboard-card.js
       type: module
   ```

## Usage

Add the card via the UI editor or manually:

```yaml
type: custom:myscoreboard-card
entities:
  - sensor.myscoreboard_nhl
  - sensor.myscoreboard_premier_league
title: "Today's Scores"
show_broadcasts: false
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | list | required | List of MyScoreboard sensor entity IDs |
| `title` | string | _(auto)_ | Optional card title |
| `show_broadcasts` | boolean | `false` | Show broadcast channel info |
