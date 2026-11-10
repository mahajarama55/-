import { Activity, Registration } from '../types';

export const CMU_DORMITORIES = [
  'หอพักชาย 1',
  'หอพักชาย 2',
  'หอพักชาย 3',
  'หอพักชาย 4',
  'หอพักชาย 5',
  'หอพักชาย 6',
  'หอพักชาย 7',
  'หอพักหญิง 1',
  'หอพักหญิง 2',
  'หอพักหญิง 3',
  'หอพักหญิง 4',
  'หอพักหญิง 5',
  'หอพักหญิง 6',
  'หอพักหญิง 7',
  'หอพักหญิง 8',
  'หอพักหญิง 9 (หอพักสีชมพู)',
  'หอพักหญิง 10 (หอพัก 40 ปี)',
  'หอพักหญิง 11',
  'หอพักหญิง 12',
  'หอพักหญิง 13',
  'หอพักนักศึกษาแม่เหียะ',
  'หอพักนานาชาติ'
];

export const CMU_FACULTIES = [
  'คณะวิศวกรรมศาสตร์',
  'คณะวิทยาศาสตร์',
  'คณะมนุษยศาสตร์',
  'คณะสังคมศาสตร์',
  'คณะบริหารธุรกิจ',
  'คณะเศรษฐศาสตร์',
  'คณะแพทยศาสตร์',
  'คณะพยาบาลศาสตร์',
  'คณะเภสัชศาสตร์',
  'คณะทันตแพทยศาสตร์',
  'คณะเทคนิคการแพทย์',
  'คณะสัตวแพทยศาสตร์',
  'คณะเกษตรศาสตร์',
  'คณะอุตสาหกรรมเกษตร',
  'คณะศึกษาศาสตร์',
  'คณะวิจิตรศิลป์',
  'คณะสถาปัตยกรรมศาสตร์',
  'คณะการสื่อสารมวลชน',
  'คณะรัฐศาสตร์และรัฐประศาสนศาสตร์',
  'คณะนิติศาสตร์',
  'วิทยาลัยศิลปะ สื่อ และเทคโนโลยี (CAMT)',
  'วิทยาลัยนานาชาตินวัตกรรมดิจิทัล (ICDI)'
];

export const ACTIVITY_CATEGORIES = [
  { id: 'sports', label: 'กีฬาและนันทนาการ', color: 'from-amber-500 to-orange-600', badge: 'bg-amber-100 text-amber-800' },
  { id: 'volunteer', label: 'จิตอาสา/บำเพ็ญประโยชน์', color: 'from-emerald-500 to-teal-700', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'skills', label: 'พัฒนาทักษะชีวิตและวิชาการ', color: 'from-blue-500 to-indigo-700', badge: 'bg-blue-100 text-blue-800' },
  { id: 'culture', label: 'ประเพณีและศิลปวัฒนธรรม', color: 'from-purple-600 to-pink-600', badge: 'bg-purple-100 text-purple-800' },
  { id: 'environment', label: 'สิ่งแวดล้อมและ 5ส หอพัก', color: 'from-teal-500 to-emerald-600', badge: 'bg-teal-100 text-teal-800' }
] as const;

export const INITIAL_ACTIVITIES: Activity[] = [];

export const INITIAL_REGISTRATIONS: Registration[] = [];

