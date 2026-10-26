SHELL := /bin/bash

TXT := site/data/counselling-links.txt
PDF := site/assets/pdfs/Counselling-Options.pdf
PDF_SCRIPT := scripts/text_to_pdf.py

.PHONY: pdf build serve clean new-link

pdf:
	python3 $(PDF_SCRIPT) $(TXT) $(PDF)

build: pdf
	cd site && bundle exec jekyll build --config _config.yml --destination ../_site

serve: pdf
	cd site && bundle exec jekyll serve --config _config.yml

clean:
	rm -rf _site

new-link:
	python3 scripts/create_interesting_link.py "$(TITLE)" "$(URL)" "$(SUMMARY)"
