export type GuestType = "adult" | "child" | "baby";
export type RsvpStatus = "pending" | "confirmed" | "declined";
export type TableType = "round" | "rectangular";
export type RoomShape = "rectangle" | "square" | "free";
export type LandmarkType = "dance_floor" | "dj" | "entrance" | "buffet";

export interface Household {
  id: string;
  name: string | null;
  wedding_date: string | null;
  partner1_name: string | null;
  partner2_name: string | null;
  budget_target: number | null;
  invite_code: string;
  room_shape: RoomShape;
  room_width: number;
  room_height: number;
  landmarks: Landmark[];
  created_at: string;
}

export interface Landmark {
  id: string;
  type: LandmarkType;
  label: string;
  pos_x: number;
  pos_y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
}

export interface Vendor {
  id: string;
  household_id: string;
  name: string;
  category: string;
  total_amount: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Un versement de l'échéancier d'un prestataire. */
export interface VendorPayment {
  id: string;
  household_id: string;
  vendor_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  /** L'échéance tombe le jour du mariage : la date effective vient de household.wedding_date. */
  due_on_wedding_day: boolean;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeddingTable {
  id: string;
  household_id: string;
  name: string;
  type: TableType;
  capacity: number;
  pos_x: number;
  pos_y: number;
  rotation: number;
  scale: number;
  created_at: string;
}

export interface Guest {
  id: string;
  household_id: string;
  first_name: string;
  last_name: string;
  type: GuestType;
  rsvp: RsvpStatus;
  group_tag: string | null;
  table_id: string | null;
  seat_index: number | null;
  created_at: string;
  updated_at: string;
}

export const VENDOR_CATEGORIES = [
  "Lieu",
  "Traiteur",
  "Déco / Fleuriste",
  "DJ / Musique",
  "Photo / Vidéo",
  "Robe / Costume",
  "Coiffure / Maquillage",
  "Voiture",
  "Faire-part",
  "Gâteau",
  "Officiant",
  "Autre",
] as const;

export const GROUP_TAGS = [
  "Famille du marié",
  "Famille de la mariée",
  "Amis",
  "Témoins",
  "Collègues",
  "Autre",
] as const;
