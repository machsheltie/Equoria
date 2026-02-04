export interface Competition {
  id: string;
  name: string;
  discipline: string;
  date: string;
  time: string;
  prizePool: number;
  participants: number;
  requirements: string[];
  imageUrl: string;
}
