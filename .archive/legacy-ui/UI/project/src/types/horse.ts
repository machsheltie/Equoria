export interface Horse {
  id: string;
  name: string;
  breed: string;
  gender: string;
  age: number;
  height: number;
  imageUrl: string;
  level: number;
  health: number;
  temperament: string;
  disciplines: string[];
  isPremium: boolean;
  category: string;
  trophies: number;
  stats: {
    speed: number;
    agility: number;
    stamina: number;
    jumping: number;
  };
  movement: {
    walk: number;
    trot: number;
    canter: number;
    gallop: number;
  };
  conformation: {
    head: number;
    neck: number;
    body: number;
    legs: number;
  };
  training: {
    daily: number;
    specialization: string;
  };
  care: {
    grooming: number;
    feeding: number;
    rest: number;
  };
}
