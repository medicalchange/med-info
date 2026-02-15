SHELL := /bin/bash

TXT := medicalchange/data/counselling-links.txt
PDF := medicalchange/assets/pdfs/Counselling-Options.pdf
PDF_SCRIPT := scripts/text_to_pdf.py

.PHONY: pdf build serve clean

pdf:
	python3 $(PDF_SCRIPT) $(TXT) $(PDF)

build: pdf
	cd medicalchange && bundle exec jekyll build --config _config.yml --destination ../_site

serve: pdf
	cd medicalchange && bundle exec jekyll serve --config _config.yml

clean:
	rm -rf _site
