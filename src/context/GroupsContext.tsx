import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { getMyGroups, GroupWithBalance } from '../services/groupService'
import { useAuth } from './AuthContext'

interface GroupsContextType {
  groups: GroupWithBalance[]
  loading: boolean
  refresh: () => Promise<void>
}

const GroupsContext = createContext<GroupsContextType>({
  groups: [],
  loading: true,
  refresh: async () => {},
})

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [groups, setGroups] = useState<GroupWithBalance[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!session) return
    try {
      const data = await getMyGroups()
      setGroups(data)
    } catch {}
    finally { setLoading(false) }
  }, [session])

  useEffect(() => { refresh() }, [refresh])

  return (
    <GroupsContext.Provider value={{ groups, loading, refresh }}>
      {children}
    </GroupsContext.Provider>
  )
}

export function useGroups() {
  return useContext(GroupsContext)
}
