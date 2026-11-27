// Vietnamese interface text: the default and, for now, only language.
// Every string a learner sees comes from here through t().
export const vi = {
  'app.name': 'Học Tiếng Anh',
  'home.tagline': 'Học tiếng Anh từ con số không, mỗi ngày một chút.',
  'home.chooseTrack': 'Chọn chủ đề',

  'track.everyday.name': 'Đời sống',
  'track.everyday.description': 'Tiếng Anh cho việc hằng ngày: chào hỏi, mua sắm, ăn uống.',
  'track.work.name': 'Công việc',
  'track.work.description': 'Tiếng Anh nơi làm việc: đồng nghiệp, khách hàng, cuộc họp.',
  'track.kids.name': 'Trẻ em',
  'track.kids.description': 'Cho bé từ 4 đến 10 tuổi, học cùng bố mẹ.',
  'track.progress': 'Đã học xong {done}/{total} bài',
  'track.comingSoon': 'Bài học sắp có',
  'track.empty': 'Chủ đề này chưa có bài học. Bạn hãy chọn chủ đề khác nhé.',
  'track.notFound': 'Không tìm thấy chủ đề này',
  'track.back': 'Về danh sách chủ đề',
  'track.progressError': 'Không đọc được tiến độ học của bạn. Bạn vẫn học được bình thường.',

  'level.a0': 'Bắt đầu',
  'level.a1': 'A1',
  'level.a2': 'A2',

  'unit.number': 'Bài {number}',
  'unit.completed': 'Đã học xong',
  'unit.notStarted': 'Chưa học',
  'unit.rowLabel': 'Bài {number}: {title}. {status}',
  'unit.rowLabelLoading': 'Bài {number}: {title}',
} as const;
