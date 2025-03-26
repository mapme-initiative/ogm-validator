import axios, { AxiosInstance } from 'axios';


const instance: AxiosInstance = axios.create({
  baseURL: `${window.location.origin}`
});

export default instance;