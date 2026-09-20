FROM node:20-alpine
WORKDIR /hugo
COPY . .
ENV HUGO_MEMORY_AUTO_PUSH=false
CMD ["node","scripts/cli/hugo.js","doctor"]
