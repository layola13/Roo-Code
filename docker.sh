# 1. 清理残留
sudo killall dockerd containerd 2>/dev/null
sleep 2
sudo rm -f /var/run/docker.sock

# 2. 启动 Docker
sudo sh -c 'dockerd > /tmp/docker.log 2>&1' &

# 3. 等待启动
sleep 5

# 4. 检查 socket
ls -la /var/run/docker.sock

# 5. 修改权限
sudo chmod 666 /var/run/docker.sock

# 6. 验证
docker ps
