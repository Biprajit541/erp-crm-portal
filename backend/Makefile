# Used by `sam build` (BuildMethod: makefile in template.yaml).
# Compiles the TypeScript and packages dist/ with production dependencies only.
build-ErpApiFunction:
	npm ci
	npm run build
	cp -r dist package.json package-lock.json "$(ARTIFACTS_DIR)"
	cd "$(ARTIFACTS_DIR)" && npm ci --omit=dev --ignore-scripts
