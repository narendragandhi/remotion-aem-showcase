# Use the official Remotion rendering image which has Chrome and all dependencies pre-installed
FROM remotiondev/renderer:4.0.0

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the WASM binary during image creation
RUN npm run build:wasm

# Create an entrypoint script to handle dynamic renders
RUN echo '#!/bin/bash \n\
npx remotion render src/index.tsx "$REMOTION_COMPOSITION" out/render.mp4 --props="$(node -e "console.log(process.env.REMOTION_PROPS || \"{}\")")" \n\
if [ "$UPLOAD_TO_AEM" = "true" ]; then \n\
  node scripts/upload-to-aem.js out/render.mp4 "$REMOTION_RENDER_DEST" \n\
fi' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Default environment variables
ENV REMOTION_COMPOSITION=AEMSpotlight-16x9
ENV USE_MOCK_AEM=false

ENTRYPOINT ["/app/entrypoint.sh"]
