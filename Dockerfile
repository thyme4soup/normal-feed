# Use the official Node.js image as the base
FROM node:22

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock to the container
COPY package.json yarn.lock ./

# Install project dependencies using Yarn
RUN yarn install

# Copy the rest of the application code to the container
COPY . .

# Expose the port your application listens on
EXPOSE 3000

# Start the application
CMD ["yarn", "start"]
