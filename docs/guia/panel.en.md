# Control panel

The control panel is Smart Mail Manager's main interface, accessible from the Thunderbird spaces toolbar button.

## Dashboard

The Dashboard tab shows a visual summary of activity:

### Statistics

- **Total / active rules** — number of configured and enabled rules
- **Classified today** — emails processed today
- **Responses today** — auto-responses sent today

### Time range filters

| Range | Description |
|-------|-------------|
| 7 days | Last week |
| 30 days | Last month |
| All | No time limit |

### Rule ranking

Shows the most active rules sorted by number of matches in the selected period.

### Top senders

Lists senders with the most classified emails.

### Folder management

From the Dashboard you can:

- **Create folders** — in any account
- **Rename folders** — change the name while keeping content
- **Delete folders** — with confirmation
- **Move content** — from one folder to another

### Process existing emails

Button to run current rules against existing emails (up to 50 by default).

## Activity log

The Log tab shows the history of all executed actions:

### Columns

| Column | Description |
|--------|-------------|
| Date | Action timestamp |
| Type | `classification`, `autoResponse` or `error` |
| Rule | Name of the matching rule |
| Subject | Email subject |
| From | Sender |
| Actions | List of executed actions |
| Details | Additional information |

### Filters

| Filter | Values |
|--------|--------|
| Type | All, Classifications, Responses, Errors |
| Search | By subject, sender or rule name |

### Pagination

The log shows paginated entries to maintain performance.

### CSV export

Exports all visible entries to an Excel-compatible CSV file (includes UTF-8 BOM).

### Retention

Entries are automatically deleted according to the `logRetentionDays` setting (default 30 days). The maximum limit is 500 entries with automatic rotation.

### Clear log

Button to delete all entries with prior confirmation.

## Global search

Shortcut: ++ctrl+k++

Searches simultaneously in:

- **Rules** — by name and condition values
- **Templates** — by name and subject
- **Log** — by subject, sender and rule name

Results link directly to the corresponding tab.

## Badges

The extension icon shows an unread classifications counter. The badge resets when opening the panel.
