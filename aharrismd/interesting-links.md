---
layout: links-page
title: Interesting Links
kicker: Reading list
description: Brief notes on articles, essays, and resources worth passing along.
back_url: /
back_label: Back to Medicallinks
---

<ul class="linklog-list">
  {% assign entries = site.interesting_links | sort: "date" | reverse %}
  {% for entry in entries %}
  <li>
    <p class="linklog-date">{{ entry.date | date: "%B %-d, %Y" }}</p>
    <p><a href="{{ entry.link_url }}" target="_blank" rel="noreferrer">{{ entry.link_title | default: entry.title }}</a></p>
    {% if entry.summary %}<p>{{ entry.summary }}</p>{% endif %}
    {% if entry.content and entry.content != "" %}{{ entry.content }}{% endif %}
  </li>
  {% endfor %}
</ul>
