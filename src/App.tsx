import React, { useState, useRef } from 'react'
import axios from 'axios'
import './App.css'

interface User {
  id: string
  name: string
  status?: 'ready' | 'testing' | 'success' | 'failed'
}

interface CouponRequest {
  userId: string
  timestamp: number
  status: 'pending' | 'success' | 'failed'
  response?: any
  error?: string
}

interface TestResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  duration: number
  responses: CouponRequest[]
}

function App() {
  const [users, setUsers] = useState<User[]>([])
  const [userCount, setUserCount] = useState<number>(1000)
  const [couponLimit, setCouponLimit] = useState<number>(500)
  const [apiUrl, setApiUrl] = useState<string>('http://localhost:3500')
  const [couponId, setCouponId] = useState<string>('WELCOME')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isGeneratingUsers, setIsGeneratingUsers] = useState<boolean>(false)
  const [isCreatingCoupon, setIsCreatingCoupon] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 유저 상태 업데이트 함수
  const updateUserStatus = (userId: string, status: 'ready' | 'testing' | 'success' | 'failed') => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, status } : user
      )
    )
  }

  // API 연결 테스트 함수 추가
  const testApiConnection = async () => {
    try {
      console.log('🔍 API 연결 테스트 시작... ', apiUrl);
      const response = await axios.get(apiUrl);
      console.log('✅ API 서버 연결 성공:', response);
      alert('API 서버 연결 성공!');
    } catch (error: any) {
      console.error('❌ API 서버 연결 실패:', error);
      alert(`API 서버 연결 실패: ${error.message}`);
    }
  }

  // 랜덤 유저 생성
  const generateUsers = async () => {
    setIsGeneratingUsers(true)
    setTestResult(null)

    // 사용자 생성에 약간의 지연을 주어 더 현실적으로 만들기
    await new Promise(resolve => setTimeout(resolve, 500))

    const newUsers = await createUsers(userCount)

    setUsers(newUsers)
    setIsGeneratingUsers(false)
  }

  const createUsers = async (count: number) : Promise<User[]> => {
    const newUsers: User[] = []

    const response = await axios.post(
      apiUrl + `/users/random?count=${count}`,
    )

    const data = response.data.data;

    console.log(`✅ 유저 ${count} 생성 성공:`, data);

    for (const user of data) {
      newUsers.push({
        id: user.id,
        name: user.name,
        status: 'ready'
      })
    }

    console.log(`🎉 총 ${newUsers.length}명의 유저 생성 완료`);
    return newUsers
  }

  // 유저 목록 초기화
  const clearUsers = () => {
    setUsers([])
    setTestResult(null)
  }

  // 단일 쿠폰 요청
  const requestCoupon = async (user: User): Promise<CouponRequest> => {
    console.log(`️ 쿠폰 요청 시작 - 유저: ${user.name} (${user.id})`);
    
    // 요청 시작 시 상태 업데이트
    updateUserStatus(user.id, 'testing');
    
    const request: CouponRequest = {
      userId: user.id,
      timestamp: Date.now(),
      status: 'pending'
    }

    try {
      console.log(`📡 쿠폰 API 요청: ${apiUrl}`);
      console.log(`📤 요청 데이터:`, { userId: user.id });
      
      const response = await axios.post(
        apiUrl + `/user-coupons`,
        { userId: user.id, couponId: couponId },
        { 
          timeout: 10000 // 10초 타임아웃
        }
      )
      
      console.log(`✅ 쿠폰 요청 성공 - 유저: ${user.name}`, response.data);
      
      // 성공 시 상태 업데이트
      updateUserStatus(user.id, 'success');
      
      return {
        ...request,
        status: 'success',
        response: response.data
      }
    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log(`⏹️ 쿠폰 요청 취소됨 - 유저: ${user.name}`);
        updateUserStatus(user.id, 'ready'); // 취소 시 ready로 되돌림
        throw error // 취소된 요청은 다시 throw
      }
      
      console.error(`❌ 쿠폰 요청 실패 - 유저: ${user.name}`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // 실패 시 상태 업데이트
      updateUserStatus(user.id, 'failed');
      
      return {
        ...request,
        status: 'failed',
        error: error.response?.data?.error?.message || error.message || '알 수 없는 오류'
      }
    }
  }

  // 동시 쿠폰 요청 테스트
  const runConcurrentTest = async () => {
    if (users.length === 0) {
      alert('먼저 유저를 생성해주세요!')
      return
    }

    if (!couponId.trim()) {
      alert('쿠폰 ID를 입력해주세요!')
      return
    }

    console.log(`🚀 [DEBUG] 동시성 테스트 시작 - ${users.length}명의 유저`);
    setIsLoading(true)
    setTestResult(null)

    try {

      console.log('🚀 동시 쿠폰 발급 테스트 시작...');
      const startTime = Date.now()

      // 모든 유저에 대해 동시에 쿠폰 요청
      const promises = users.map(user => 
        requestCoupon(user)
      )

      console.log(`📊 [DEBUG] ${promises.length}개의 Promise 생성 완료`);
      
      const results = await Promise.allSettled(promises)
      const endTime = Date.now()
      
      console.log(`📊 [DEBUG] Promise.allSettled 완료 - 소요시간: ${endTime - startTime}ms`);

      const responses: CouponRequest[] = []
      let successCount = 0
      let failedCount = 0

      results.forEach((result, index) => {
        console.log(`📊 [DEBUG] 결과 ${index + 1}:`, result);
        
        if (result.status === 'fulfilled') {
          responses.push(result.value)
          if (result.value.status === 'success') {
            successCount++
          } else {
            failedCount++
          }
        } else {
          // Promise가 reject된 경우 (취소 등)
          responses.push({
            userId: users[index].id,
            timestamp: Date.now(),
            status: 'failed',
            error: result.reason?.message || '요청 실패'
          })
          failedCount++
        }
      })

      console.log(`📊 [DEBUG] 최종 결과: 성공 ${successCount}, 실패 ${failedCount}`);

      setTestResult({
        totalRequests: users.length,
        successfulRequests: successCount,
        failedRequests: failedCount,
        duration: endTime - startTime,
        responses
      })

    } catch (error: any) {
      console.error('테스트 실행 중 오류:', error)
      alert('테스트 실행 중 오류가 발생했습니다.')
      
      // 에러 발생 시 모든 유저 상태를 ready로 초기화
      setUsers(prevUsers => 
        prevUsers.map(user => ({ ...user, status: 'ready' as const }))
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // 테스트 취소
  const cancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      
      // 취소 시 모든 유저 상태를 ready로 초기화
      setUsers(prevUsers => 
        prevUsers.map(user => ({ ...user, status: 'ready' as const }))
      )
    }
  }

  // 쿠폰 생성 함수
  const createCoupon = async () => {
    if (!couponId.trim()) {
      alert('쿠폰 ID를 입력해주세요!')
      return false
    }

    setIsCreatingCoupon(true)
    
    try {
      console.log('🎫 쿠폰 생성 시작:', couponId);
      
      const couponData = {
        couponId: couponId,
        quantity: couponLimit,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30일 후
      }
      
      console.log('📤 쿠폰 생성 데이터:', couponData);
      
      const response = await axios.post(
        apiUrl + '/coupons',
        couponData,
        { timeout: 10000 }
      )
      
      console.log('✅ 쿠폰 생성 성공:', response.data);
      alert(`쿠폰 "${couponId}" 생성 완료! (한도: ${couponLimit}개)`);
      return true
      
    } catch (error: any) {
      console.error('❌ 쿠폰 생성 실패:', error);
      alert(`쿠폰 생성 실패: ${error.response?.data?.error?.message || error.message}`);
      return false
    } finally {
      setIsCreatingCoupon(false)
    }
  }

  return (
    <div className="App">
      <div className="container">
        <h1>🎫 쿠폰 시스템 동시성 테스트</h1>

        {/* 설정 섹션 */}
        <div className="config-section">
          <h2>⚙️ 테스트 설정</h2>

          <div className="input-group">
            <label>API URL:</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="/api"
            />
            <small>프록시를 통해 localhost:3000과 연결됩니다</small>
          </div>

          <div className="input-group">
            <button 
              onClick={testApiConnection} 
              disabled={isGeneratingUsers || isLoading}
              style={{
                background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔍 API 연결 테스트
            </button>
          </div>

          <div className="input-group">
            <label>생성할 유저 수:</label>
            <input
              type="number"
              value={userCount}
              onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="10000"
              disabled={isGeneratingUsers || isLoading}
            />
          </div>

          <div className="input-group">
            <label>쿠폰 한도:</label>
            <input
              type="number"
              value={couponLimit}
              onChange={(e) => setCouponLimit(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="10000"
            />
          </div>

          <div className="input-group">
            <label>쿠폰 ID:</label>
            <input
              type="text"
              value={couponId}
              onChange={(e) => setCouponId(e.target.value)}
              placeholder="WELCOME"
              disabled={isGeneratingUsers || isLoading || isCreatingCoupon}
            />
            <small>발급할 쿠폰의 고유 ID를 입력하세요</small>
          </div>
        </div>

        {/* 유저 생성 섹션 */}
        <div className="user-generation-section">
          <h2>👥 유저 생성</h2>

          <div className="user-generation-info">
            <div className="info-item">
              <span className="label">설정된 유저 수:</span>
              <span className="value">{userCount}명</span>
            </div>
            <div className="info-item">
              <span className="label">생성된 유저 수:</span>
              <span className="value">{users.length}명</span>
            </div>
            <div className="info-item">
              <span className="label">상태:</span>
              <span className={`value ${users.length > 0 ? 'ready' : 'waiting'}`}>
                {isGeneratingUsers ? '생성 중...' : users.length > 0 ? '준비 완료' : '대기 중'}
              </span>
            </div>
          </div>

          <div className="button-group">
            <button
              onClick={generateUsers}
              disabled={isGeneratingUsers || isLoading}
              className="generate-button"
            >
              {isGeneratingUsers ? (
                <>
                  <span className="spinner-small"></span>
                  유저 생성 중...
                </>
              ) : (
                <>
                  👥 유저 {userCount}명 생성
                </>
              )}
            </button>

            {users.length > 0 && (
              <button
                onClick={clearUsers}
                disabled={isGeneratingUsers || isLoading}
                className="clear-button"
              >
                🗑️ 유저 목록 초기화
              </button>
            )}
          </div>
        </div>

        {/* 유저 목록 시각화 */}
        {users.length > 0 && (
          <div className="users-section">
            <h3>📊 생성된 유저 현황</h3>

            <div className="users-summary">
              <div className="summary-card">
                <div className="summary-number">{users.length}</div>
                <div className="summary-label">총 유저 수</div>
              </div>
              <div className="summary-card">
                <div className="summary-number">{users.length}</div>
                <div className="summary-label">테스트 준비완료</div>
              </div>
              <div className="summary-card">
                <div className="summary-number">{new Date().toLocaleTimeString()}</div>
                <div className="summary-label">생성 완료 시간</div>
              </div>
            </div>

            {users.length <= 20 && (
              <div className="users-preview">
                <h4>유저 목록 미리보기</h4>
                <div className="users-simple-list">
                  {users.map((user, index) => (
                    <div key={user.id} className="user-simple-item">
                      <span className="user-number">#{index + 1}</span>
                      <span className="user-name">{user.name}</span>
                      <span className="user-id-short">{user.id.substring(0, 6)}...</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {users.length > 20 && (
              <div className="users-preview">
                <h4>유저 샘플 (처음 10명)</h4>
                <div className="users-simple-list">
                  {users.slice(0, 10).map((user, index) => (
                    <div key={user.id} className="user-simple-item">
                      <span className="user-number">#{index + 1}</span>
                      <span className="user-name">{user.name}</span>
                      <span className="user-id-short">{user.id.substring(0, 6)}...</span>
                    </div>
                  ))}
                </div>
                <div className="more-users-simple">
                  <p>... 외 {users.length - 10}명의 유저</p>
                  <p>💡 대량 테스트 모드: 개별 유저 표시를 간소화했습니다</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 쿠폰 생성 섹션 */}
        <div className="coupon-section">
          <h2>🎫 쿠폰 생성</h2>
          
          <div className="coupon-info">
            <div className="info-item">
              <span className="label">쿠폰 ID:</span>
              <span className="value">{couponId || '입력 필요'}</span>
            </div>
            <div className="info-item">
              <span className="label">발급 한도:</span>
              <span className="value">{couponLimit}개</span>
            </div>
            <div className="info-item">
              <span className="label">상태:</span>
              <span className={`value ${couponId ? 'ready' : 'waiting'}`}>
                {isCreatingCoupon ? '생성 중...' : couponId ? '준비 완료' : '설정 필요'}
              </span>
            </div>
          </div>

          <div className="button-group">
            <button
              onClick={createCoupon}
              disabled={!couponId.trim() || isGeneratingUsers || isLoading || isCreatingCoupon}
              className="generate-button"
            >
              {isCreatingCoupon ? (
                <>
                  <span className="spinner-small"></span>
                  쿠폰 생성 중...
                </>
              ) : (
                <>
                  🎫 쿠폰 "{couponId}" 생성 (한도: {couponLimit}개)
                </>
              )}
            </button>
          </div>
        </div>

        {/* 테스트 실행 */}
        <div className="test-section">
          <h2>🚀 동시성 테스트</h2>

          {users.length === 0 ? (
            <div className="test-warning">
              <p>⚠️ 테스트를 시작하려면 먼저 유저를 생성해주세요.</p>
            </div>
          ) : !couponId.trim() ? (
            <div className="test-warning">
              <p>⚠️ 테스트를 시작하려면 쿠폰 ID를 입력해주세요.</p>
            </div>
          ) : (
            <div className="test-ready">
              <p>✅ {users.length}명의 유저와 쿠폰 "{couponId}" (한도: {couponLimit}개)가 준비되었습니다.</p>
              <p>🎯 동시 쿠폰 발급 테스트를 시작할 수 있습니다.</p>
            </div>
          )}

          <div className="button-group">
            {!isLoading ? (
              <button
                onClick={runConcurrentTest}
                disabled={users.length === 0 || !couponId.trim()}
                className="test-button"
              >
                🚀 동시 쿠폰 발급 테스트 시작
              </button>
            ) : (
              <button onClick={cancelTest} className="cancel-button">
                ⏹️ 테스트 취소
              </button>
            )}
          </div>

          {isLoading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>테스트 실행 중... {users.length}개의 동시 요청을 처리하고 있습니다.</p>
            </div>
          )}

          {/* 도트 형태 전체 유저 시각화 (1명 이상일 때) */}
          {users.length >= 1 && (
            <div className="users-dots-section">
              <h4>📍 전체 유저 시각화 ({users.length}명)</h4>
              <div className="users-dots-container">
                <div className="dots-legend">
                  <span className="legend-item">
                    <span className="dot-sample ready"></span>
                    준비 완료
                  </span>
                  <span className="legend-item">
                    <span className="dot-sample testing"></span>
                    테스트 중
                  </span>
                  <span className="legend-item">
                    <span className="dot-sample success"></span>
                    성공
                  </span>
                  <span className="legend-item">
                    <span className="dot-sample failed"></span>
                    실패
                  </span>
                </div>
                <div className="users-dots-grid">
                  {users.map((user, index) => (
                    <div
                      key={user.id}
                      className={`user-dot ${user.status || 'ready'}`}
                      title={`#${index + 1}: ${user.name} (${user.id.substring(0, 8)}...) - ${
                        user.status === 'ready' ? '준비 완료' :
                        user.status === 'testing' ? '테스트 중' :
                        user.status === 'success' ? '성공' :
                        user.status === 'failed' ? '실패' : '준비 완료'
                      }`}
                    ></div>
                  ))}
                </div>
                <div className="dots-info">
                  <p>각 점은 한 명의 유저를 나타냅니다. 마우스를 올리면 상세 정보를 볼 수 있습니다.</p>
                  <p>테스트 진행 중에는 실시간으로 색상이 변경됩니다.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 테스트 결과 */}
        {testResult && (
          <div className="results-section">
            <h2>📊 테스트 결과</h2>

            <div className="summary">
              <div className="summary-item">
                <span className="label">총 요청 수:</span>
                <span className="value">{testResult.totalRequests}</span>
              </div>
              <div className="summary-item success">
                <span className="label">성공:</span>
                <span className="value">{testResult.successfulRequests}</span>
              </div>
              <div className="summary-item failed">
                <span className="label">실패:</span>
                <span className="value">{testResult.failedRequests}</span>
              </div>
              <div className="summary-item">
                <span className="label">소요 시간:</span>
                <span className="value">{testResult.duration}ms</span>
              </div>
              <div className="summary-item">
                <span className="label">성공률:</span>
                <span className="value">
                  {((testResult.successfulRequests / testResult.totalRequests) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="analysis">
              <h3>분석</h3>
              <p>
                예상 쿠폰 한도 {couponLimit}개에 대해 {testResult.successfulRequests}개가 성공적으로 발급되었습니다.
                {testResult.successfulRequests <= couponLimit ?
                  " ✅ 정상적으로 한도가 지켜졌습니다." :
                  " ⚠️ 한도를 초과하여 발급되었습니다."
                }
              </p>
            </div>

            <div className="detailed-results">
              <h3>상세 결과</h3>
              <div className="results-info">
                <p>총 {testResult.responses.length}개의 결과가 있습니다. 스크롤하여 모든 결과를 확인하세요.</p>
              </div>
              <div className="results-grid">
                {testResult.responses.map((response, index) => (
                  <div
                    key={index}
                    className={`result-item ${response.status}`}
                  >
                    <div className="user-info">
                      <strong>User {index + 1}</strong>
                      <small>{response.userId}</small>
                    </div>
                    <div className={`status ${response.status}`}>
                      {response.status === 'success' ? '✅ 성공' : '❌ 실패'}
                    </div>
                    {response.error && (
                      <div className="error">{response.error}</div>
                    )}
                    {response.response && (
                      <div className="response">
                        <small>{JSON.stringify(response.response, null, 2)}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
