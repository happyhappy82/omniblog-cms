import React from 'react';
import {
  Cpu,
  Map,
  Utensils,
  Briefcase,
  Settings,
  Plus,
  Save,
  Trash2,
  Wand2,
  Send,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Loader2,
  FileText,
  ArrowLeftRight,
  RotateCcw,
  UserCircle,
  Square,
  CheckSquare,
  Code,
  Link,
  Table,
  Eye,
  PenLine,
  Underline,
  AlignLeft,
  Smile,
  Copy,
  Sparkles,
  Building,
  TrendingUp,
  Landmark,
  Stethoscope,
  Search,
  X
} from 'lucide-react';

const icons = {
  Cpu, Map, Utensils, Briefcase, Settings, Plus, Save, Trash2, Wand2, Send,
  Bold, Italic, List, ListOrdered, Heading1, Heading2, ImageIcon, Check, ChevronRight, Loader2, FileText,
  ArrowLeftRight, RotateCcw, UserCircle, Square, CheckSquare, Code, Link, Table, Eye, PenLine,
  Underline, AlignLeft, Smile, Copy, Sparkles,
  Building, TrendingUp, Landmark, Stethoscope, Search, X
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, className = "" }) => {
  const IconComponent = icons[name as keyof typeof icons] || icons.FileText;
  return <IconComponent size={size} className={className} />;
};
