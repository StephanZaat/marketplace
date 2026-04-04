import {
  Activity, Anchor, Archive, Armchair, Baby, Backpack, Bed, Bike, Bird, Blocks,
  BookOpen, Box, Briefcase, Brush, Building2, Cable, Calendar, Camera, Car,
  ChefHat, Circle, ClipboardList, Coffee, Container, Cpu, CreditCard, Dice5,
  Disc, DoorOpen, Droplets, Dumbbell, FileText, Film, Fish, Flame, Flower as FlowerIcon,
  Footprints, Gamepad2, Gauge, Gem, Gift, Glasses, GraduationCap, Hammer, HardDrive,
  HardHat, Headphones, Heart, Home, Image, Lamp, Landmark, Laptop, Layers,
  LayoutGrid, Leaf, Lightbulb, Luggage, Map, MapPin, Monitor, MoreHorizontal,
  Music, Package, Paintbrush, Palette, PartyPopper, PawPrint, Plane, Printer,
  Puzzle, Radio, Refrigerator, Scissors, Settings, Shield, Shirt, ShoppingBag,
  ShoppingCart, Shovel, Smartphone, Sofa, Sparkles, Star, Tablet, Tent, Ticket,
  Train, TreePine, Trees, TrendingUp, Trophy, Truck, Tv, Umbrella, Users,
  UtensilsCrossed, Video, Volume2, Wallet, Warehouse, WashingMachine, Watch,
  Waves, Wheat, Wifi, Wind, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Activity, Anchor, Archive, Armchair, Baby, Backpack, Bed, Bike, Bird, Blocks,
  BookOpen, Box, Briefcase, Brush, Building2, Cable, Calendar, Camera, Car,
  ChefHat, Circle, ClipboardList, Coffee, Container, Cpu, CreditCard, Dice5,
  Disc, DoorOpen, Droplets, Dumbbell, FileText, Film, Fish, Flame, FlowerIcon,
  Footprints, Gamepad2, Gauge, Gem, Gift, Glasses, GraduationCap, Hammer, HardDrive,
  HardHat, Headphones, Heart, Home, Image, Lamp, Landmark, Laptop, Layers,
  LayoutGrid, Leaf, Lightbulb, Luggage, Map, MapPin, Monitor, MoreHorizontal,
  Music, Package, Paintbrush, Palette, PartyPopper, PawPrint, Plane, Printer,
  Puzzle, Radio, Refrigerator, Scissors, Settings, Shield, Shirt, ShoppingBag,
  ShoppingCart, Shovel, Smartphone, Sofa, Sparkles, Star, Tablet, Tent, Ticket,
  Train, TreePine, Trees, TrendingUp, Trophy, Truck, Tv, Umbrella, Users,
  UtensilsCrossed, Video, Volume2, Wallet, Warehouse, WashingMachine, Watch,
  Waves, Wheat, Wifi, Wind, Wrench, Zap,
};

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || MoreHorizontal;
}
